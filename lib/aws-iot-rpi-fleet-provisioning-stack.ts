// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as iot from '@aws-cdk/aws-iot';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as s3Assets from '@aws-cdk/aws-s3-assets';
import * as cr from '@aws-cdk/custom-resources';
import * as lambda from '@aws-cdk/aws-lambda';
import * as secrets from '@aws-cdk/aws-secretsmanager';
import * as targets from '@aws-cdk/aws-events-targets';
import * as cloudtrail from '@aws-cdk/aws-cloudtrail';

export interface AwsIotRpiFleetProvisioningStackProps extends cdk.StackProps {
  /**
   * SSH Key that's used for logging into the Raspberry Pi
   */
  sshPublicKey: string;
  /**
   * Name of the secret where the password used by the Raspberry Pi to connect to the Wifi is stored
   */
  wifiPasswordSecretName: string;
  /**
   * Country code for the Wifi network (e.g. 'US')
   */
  wifiCountry: string;
  /**
   * SSID of the Wifi network the Raspberry Pi will connect to
   */
  wifiSsid: string;
  /**
   * Timezone of the device
   */
  timezone: string;
}

export class AwsIotRpiFleetProvisioningStack extends cdk.Stack {
  private readonly provisioningClientArchiveName: string = 'provisioning-client.zip';

  /**
   * Create a custom raspbian image that automatically provision a RaspberryPi with AWS IoT on its first boot
   * @param scope 
   * @param id 
   * @param props 
   */
  constructor(scope: cdk.Construct, id: string, props: AwsIotRpiFleetProvisioningStackProps) {
    super(scope, id, props);

    // Policy attached to IoT things generated by this stack
    const thingsPolicy = new iot.CfnPolicy(this, 'thingsPolicy', {
      policyDocument: {
        'Version': '2012-10-17',
        'Statement': [
          {
            'Effect': 'Allow',
            'Action': ['iot:*'],
            'Resource': ['*'],
          },
        ]
      }
    });

    // Give the AWS IoT service permission to create or update IoT resources such as things and certificates in your account when provisioning devices
    const provisioningRole = new iam.Role(this, 'ProvisioningRoleArn', {
      assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),
    });
    provisioningRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSIoTThingsRegistration'));

    // The provisioning template used to create IoT things
    // https://docs.aws.amazon.com/iot/latest/developerguide/provision-template.html
    const provisioningTemplate = new iot.CfnProvisioningTemplate(this, 'ProvisioningTemplate', {
      provisioningRoleArn: provisioningRole.roleArn,
      enabled: true,
      templateBody: `{
        "Parameters": {
          "SerialNumber": {
            "Type": "String"
          },
          "AWS::IoT::Certificate::Id": {
            "Type": "String"
          }
        },
        "Resources": {
          "certificate": {
            "Properties": {
              "CertificateId": {
                "Ref": "AWS::IoT::Certificate::Id"
              },
              "Status": "Active"
            },
            "Type": "AWS::IoT::Certificate"
          },
          "policy": {
            "Properties": {
              "PolicyName": "${thingsPolicy.ref}"
            },
            "Type": "AWS::IoT::Policy"
          },
          "thing": {
            "OverrideSettings": {
              "AttributePayload": "MERGE",
              "ThingGroups": "DO_NOTHING",
              "ThingTypeName": "REPLACE"
            },
            "Properties": {
              "ThingGroups": [],
              "ThingTypeName" :  "RPI",
              "ThingName": {
                "Ref": "SerialNumber"
              }
            },
            "Type": "AWS::IoT::Thing"
          }
        },
        "DeviceConfiguration": {
        }
      }`
    });

    // AWS IoT fleet provisioning uses bootstrap certificates to generate things certificates
    // This policy restricts the use of bootstrap certificates to device provisioning
    const bootstrapPolicy = new iot.CfnPolicy(this, 'BootstrapPolicy', {
      policyDocument: {
        "Version": "2012-10-17",
        "Statement": [
          {
            "Effect": "Allow",
            "Action": ["iot:Connect"],
            "Resource": ["*"]
          },
          {
            "Effect": "Allow",
            "Action": ["iot:Publish", "iot:Receive"],
            "Resource": [
              `arn:aws:iot:${this.region}:${this.account}:topic/$aws/certificates/create/*`,
              `arn:aws:iot:${this.region}:${this.account}:topic/$aws/provisioning-templates/${provisioningTemplate.ref}/provision/*`
            ]
          },
          {
            "Effect": "Allow",
            "Action": ["iot:Subscribe"],
            "Resource": [
              `arn:aws:iot:${this.region}:${this.account}:topicfilter/$aws/certificates/create/*`,
              `arn:aws:iot:${this.region}:${this.account}:topicfilter/$aws/provisioning-templates/${provisioningTemplate.ref}/provision/*`
            ]
          }
        ]
      }
    });

    // The bucket where the codebuild artifacts and sources are stored
    // This is where the modified raspbian image generated by codebuild is stored
    const provisioningArtifactsBucket = new s3.Bucket(this, 'ProvisioningArtifactsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // Codebuild project that generates the raspbian image
    const createRpiImageProject = new codebuild.Project(this, 'CreateRPIImage', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_4_0,
        privileged: true,
      },
      source: codebuild.Source.s3({
        bucket: provisioningArtifactsBucket,
        // The provisioning client archive contains the firstboot script and the aws-iot-fleet-provisioning client
        // that are used to run device provisioning logic on first boot
        path: this.provisioningClientArchiveName,
      }),
      artifacts: codebuild.Artifacts.s3({
        bucket: provisioningArtifactsBucket,
        name: 'aws-raspbian.zip',
        packageZip: true,
      }),
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        env: {
          variables: {
            'SSH_PUBLIC_KEY': props.sshPublicKey,
            'WIFI_SSID': props.wifiSsid,
            'WIFI_COUNTRY': props.wifiCountry,
            'TIMEZONE': props.timezone,
            'ARTIFACT_IMAGE_NAME': 'aws-raspbian.img',
            'RASPBIAN_DOWNLOAD_FILENAME': 'raspbian_image.zip',
            'RASPBIAN_SOURCE_URL': 'https://downloads.raspberrypi.org/raspbian_latest',
            'RASPBIAN_URL_BASE': 'https://downloads.raspberrypi.org/raspbian/images/',
            'SDCARD_MOUNT': '/mnt/sdcard',
          },
          'secrets-manager': {
            'WIFI_PASSWORD': `${props.wifiPasswordSecretName}`,
          },
        },
        phases: {
          install: {
            commands: [
              // Install dependencies
              'apt-get update',
              'apt-get -y install p7zip-full wget libxml2-utils kpartx',
            ],
          },
          pre_build: {
            commands: [
              // Download raspbian, unzip it and SHA verify the download
              'wget $RASPBIAN_SOURCE_URL -O $RASPBIAN_DOWNLOAD_FILENAME',
              `VERSION="$( wget -q $RASPBIAN_URL_BASE -O - | xmllint --html --xmlout --xpath 'string(/html/body/table/tr[last()-1]/td/a/@href)' - )"`,
              `RASPBIAN_SOURCE_SHA256_FILE=$( wget -q $RASPBIAN_URL_BASE/$VERSION -O - | xmllint --html --xmlout --xpath 'string(/html/body/table/tr/td/a[contains(@href, "256")])' - )`,
              `RASPBIAN_SOURCE_SHA256=$( wget -q "$RASPBIAN_URL_BASE/$VERSION/$RASPBIAN_SOURCE_SHA256_FILE" -O - | awk '{print $1}' )`,
              `RASPBIAN_DOWNLOAD_SHA256=$( sha256sum $RASPBIAN_DOWNLOAD_FILENAME |awk '{printf $1}' )`,
              `if [ ! -z $RASPBIAN_SOURCE_SHA256 ] && [ "$RASPBIAN_DOWNLOAD_SHA256" != "$RASPBIAN_SOURCE_SHA256" ]; then echo "Build aborted.  SHA256 does not match"; exit 2; fi`,
              '7z x -y $RASPBIAN_DOWNLOAD_FILENAME',
              // Find the image name within the zip & set to variable'
              `EXTRACTED_IMAGE=$( 7z l $RASPBIAN_DOWNLOAD_FILENAME | awk '/-raspbian-/ {print $NF}' )`,
            ],
          },
          build: {
            commands: [
              // Create device mapper entries for boot disk and root disk
              'KPARTX_OUTPUT=$( kpartx -v -a "$EXTRACTED_IMAGE" )',
              `BOOT_DISK=$( echo $KPARTX_OUTPUT | grep -o 'loop.p1' )`,
              `ROOT_DISK=$( echo $KPARTX_OUTPUT | grep -o 'loop.p2' )`,
              // mount boot disk
              'mkdir -p $SDCARD_MOUNT',
              'mount /dev/mapper/${BOOT_DISK} $SDCARD_MOUNT',
              // Configure Wifi
              `echo "
ctrl_interface=DIR=/var/run/wpa_suplicant GROUP=netdev
update_config=1
country=$WIFI_COUNTRY

network={
    ssid=\\"$WIFI_SSID\\"
    key_mgmt=NONE
}" > "$SDCARD_MOUNT/wpa_supplicant.conf"`,
              // Enable ssh
              'touch "$SDCARD_MOUNT/ssh"',
              // Copy firstboot script that runs the fleet provisioning client on first boot
              'cp -v firstboot.sh "$SDCARD_MOUNT/firstboot.sh"',
              'umount "$SDCARD_MOUNT"',
              // Mount root disk
              'mount /dev/mapper/${ROOT_DISK} $SDCARD_MOUNT',
              //Set raspi-config
              `echo "
# For more options and information see
# http://rpf.io/configtxt
# Some settings may impact device functionality. See link above for details

# uncomment if you get no picture on HDMI for a default "safe" mode
#hdmi_safe=1

# uncomment this if your display has a black border of unused pixels visible
# and your display can output without overscan
#disable_overscan=1

# uncomment the following to adjust overscan. Use positive numbers if console
# goes off screen, and negative if there is too much border
#overscan_left=16
#overscan_right=16
#overscan_top=16
#overscan_bottom=16

# uncomment to force a console size. By default it will be display's size minus
# overscan.
#framebuffer_width=1280
#framebuffer_height=720

# uncomment if hdmi display is not detected and composite is being output
#hdmi_force_hotplug=1

# uncomment to force a specific HDMI mode (this will force VGA)
#hdmi_group=1
#hdmi_mode=1

# uncomment to force a HDMI mode rather than DVI. This can make audio work in
# DMT (computer monitor) modes
#hdmi_drive=2

# uncomment to increase signal to HDMI, if you have interference, blanking, or
# no display
#config_hdmi_boost=4

# uncomment for composite PAL
#sdtv_mode=2

#uncomment to overclock the arm. 700 MHz is the default.
#arm_freq=800

# Uncomment some or all of these to enable the optional hardware interfaces
#dtparam=i2c_arm=on
#dtparam=i2s=on
#dtparam=spi=on

# Uncomment this to enable infrared communication.
#dtoverlay=gpio-ir,gpio_pin=17
#dtoverlay=gpio-ir-tx,gpio_pin=18

# Additional overlays and parameters are documented /boot/overlays/README

# Enable audio (loads snd_bcm2835)
dtparam=audio=on

[pi4]
# Enable DRM VC4 V3D driver on top of the dispmanx display stack
dtoverlay=vc4-fkms-v3d
max_framebuffers=2

[all]
#dtoverlay=vc4-fkms-v3d
start_x=1
gpu_mem=128
" > "$SDCARD_MOUNT/boot/config.txt"`,
                //Set the timezone
              'timedatectl set-timezone \\"$TIMEZONE\\',
              // Change the sshd_config file to disable password authentication
              `sed -e 's;^#PasswordAuthentication.*$;PasswordAuthentication no;g' -e 's;^PermitRootLogin .*$;PermitRootLogin no;g' -i "$SDCARD_MOUNT/etc/ssh/sshd_config"`,
              // Add the ssh public key to the list of authorized keys
              'mkdir "$SDCARD_MOUNT/home/pi/.ssh"',
              'chmod 0700 "$SDCARD_MOUNT/home/pi/.ssh"',
              'chown 1000:1000 "$SDCARD_MOUNT/home/pi/.ssh"',
              'echo $SSH_PUBLIC_KEY >> "$SDCARD_MOUNT/home/pi/.ssh/authorized_keys"',
              'chown 1000:1000 "$SDCARD_MOUNT/home/pi/.ssh/authorized_keys"',
              'chmod 0600 "$SDCARD_MOUNT/home/pi/.ssh/authorized_keys"',
              // Copy the fleet provisioning client
              'cp -rv "aws-iot-fleet-provisioning" "$SDCARD_MOUNT/etc/"',
              // Copy and enable the first boot service that triggers the firstboot script on startup
              'cp -v firstboot.service "$SDCARD_MOUNT/lib/systemd/system/firstboot.service"',
              'cd "$SDCARD_MOUNT/etc/systemd/system/multi-user.target.wants" && ln -s "/lib/systemd/system/firstboot.service" "./firstboot.service"',
              'cd -',
              // Unmount disk and create the artifact
              'umount "$SDCARD_MOUNT"',
              'cp -v $EXTRACTED_IMAGE $ARTIFACT_IMAGE_NAME',
            ],
          },
        },
        artifacts: {
          files: [
            '$ARTIFACT_IMAGE_NAME',
          ],
        },
      }),
    });

    // Give access to the secret containing the wifi password to the codebuild project
    if (createRpiImageProject.role) {
      const rpiSecret = secrets.Secret.fromSecretNameV2(this, 'RPISecrets', props.wifiPasswordSecretName);
      rpiSecret.grantRead(createRpiImageProject.role);
    }

    // Configure CloudTrail on the artifacts bucket to kick off the codebuild project when the provisioning client archive is modified
    const trail = new cloudtrail.Trail(this, 'RPIArtifactsBucketCloudTrail');

    trail.addS3EventSelector([{
      bucket: provisioningArtifactsBucket,
      objectPrefix: this.provisioningClientArchiveName,
    }], {
      readWriteType: cloudtrail.ReadWriteType.WRITE_ONLY,
    });

    provisioningArtifactsBucket.onCloudTrailWriteObject('CreateRPIImageOnProvisioningClientUpdate', {
      target: new targets.CodeBuildProject(createRpiImageProject),
      paths: [this.provisioningClientArchiveName],
    });

    // Lambda that configures the provisioning client and store it in the artifacts bucket
    const provisioningFunction = new lambda.Function(this, 'ProvisioningFunction', {
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'app.on_event',
      code: lambda.Code.fromAsset(path.join(__dirname, './lambda/bootstrap_client')),
      timeout: cdk.Duration.seconds(60),
      initialPolicy: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'iot:CreateKeysAndCertificate',
            'iot:AttachPolicy',
            'iot:DescribeEndpoint',
            'iot:CreateThingType',
            'iot:UpdateEventConfigurations',
          ],
          resources: ['*'],
        }),
      ],
    });

    const provisioningClientAsset = new s3Assets.Asset(this, 'ProvisioningClientAsset', {
      path: path.join(__dirname, '../provisioning-client'),
    });

    provisioningArtifactsBucket.grantWrite(provisioningFunction);
    provisioningClientAsset.grantRead(provisioningFunction);

    // Custom resource that calls the ProvisioningFunction Lambda
    const thingsProvisioningCr = new cdk.CustomResource(this, 'ThingsProvisioningCR', {
      serviceToken: new cr.Provider(this, 'ThingsProvisioningProvider', {
        onEventHandler: provisioningFunction,
      }).serviceToken,
      properties: {
        'BOOTSTRAP_POLICY_NAME': bootstrapPolicy.ref,
        'PROVISIONING_CLIENT_BUCKET_NAME': provisioningClientAsset.s3BucketName,
        'PROVISIONING_CLIENT_OBJECT_KEY': provisioningClientAsset.s3ObjectKey,
        'PROVISIONING_ARTIFACTS_BUCKET_NAME': provisioningArtifactsBucket.bucketName,
        'PROVISIONING_TEMPLATE_NAME': provisioningTemplate.ref,
        'PROVISIONING_CLIENT_ARCHIVE_NAME': this.provisioningClientArchiveName,
      },
    });

    // Create the custom resource after the codebuild project
    // This way, the codebuild project is automatically started when the provisioning client is uploaded for the first time
    thingsProvisioningCr.node.addDependency(createRpiImageProject);

    new cdk.CfnOutput(this, 'ThingsProvisioningArtifactsBucketName', {
      description: 'Download the raspbian image from this S3 bucket',
      value: provisioningArtifactsBucket.bucketName,
    });

  }
}
