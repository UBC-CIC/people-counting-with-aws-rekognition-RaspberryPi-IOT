#!/bin/bash
# MIT License 
# Copyright (c) 2017 Ken Fallon http://kenfallon.com
# 
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
# 
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
# 
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

# renames the hostname of the Raspberry Pi to a version based on it’s Ethernet MAC address.
device_serial=$( sed 's/://g' /sys/class/net/eth0/address )
sed "s/raspberrypi/${device_serial}/g" -i /etc/hostname /etc/hosts

# generate device key and certificate
cd /etc/aws-iot-fleet-provisioning
pip3 install -r requirements.txt
python3 main.py ${device_serial}

if [[ -f /etc/aws-iot-fleet-provisioning/certs/certificate.pem && -f /etc/aws-iot-fleet-provisioning/certs/private.key && -f /etc/aws-iot-fleet-provisioning/certs/root.ca.pem ]]; then
    # store iot certificates
    logger ":-------------- Network is up: --------------"
    sudo mkdir -p /home/pi/Desktop/iot
    sudo mv /etc/aws-iot-fleet-provisioning/certs/* /home/pi/Desktop/iot
    touch /home/pi/Desktop/iot/device.json
    iot_endpoint=$( sudo sed -n /IOT_ENDPOINT/p  /etc/aws-iot-fleet-provisioning/config.ini | cut -d' ' -f 3 )
    sudo echo "{
    \"certs\": {
        \"caPath\": \"certs/root.ca.pem\",
        \"certPath\": \"certs/certificate.pem\",
        \"keyPath\": \"certs/private.key\"
      },
    \"state\": {
        \"photoWidth\": 640,
        \"photoHeight\": 480,
        \"samplingRate\": 30,
        \"endHour\": 20,
        \"beginHour\": 7
      },
    \"clientId\" : \"${device_serial}\",
    \"topicSendControlImage\" : \"takePhoto\",
    \"topicGetSignedURL\" : \"s3-signed-url\",
    \"host\" : \"${iot_endpoint}\"
    }" > "/home/pi/Desktop/iot/device.json"
    sudo echo "
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
" > "/boot/configTemp.txt"
    #Clone the repository to run the IOT application
    githubLink=$( sudo sed -n /GITHUBLINK/p  /etc/wpa_supplicant/wpa_supplicant.conf | cut -d' ' -f 4 | sed 's/"//g')
    logger "githubLink : ${githubLink}"
    cd /home/pi/Desktop
    ATTEMPT=0
    while [ $ATTEMPT -le 4 ]; do
          ATTEMPT=$(( $ATTEMPT + 1 ))
          logger "Waiting for git clone (ATTEMPT: $ATTEMPT)..."
          if ! git clone $githubLink rpi
          then
            logger ":---Clone failed:---"
          else
            logger ":---Clone success:---"
            break
          fi
          sleep 5
    done
    #Copy the certificates into the cloned repo
    sudo mv /boot/configTemp.txt /boot/config.txt
    cd /home/pi/Desktop/iot
    cp ./* ../rpi
    cd /home/pi/Desktop/rpi
    mkdir certs
    mv ./certificate.pem ./certs/certificate.pem
    mv ./private.key ./certs/private.key
    mv ./root.ca.pem ./certs/root.ca.pem
    #Install node
    logger "Installing node ..."
    wget https://nodejs.org/dist/v14.16.0/node-v14.16.0-linux-armv7l.tar.xz
    tar -xf node-v14.16.0-linux-armv7l.tar.xz
    cd  ./node-v14.16.0-linux-armv7l
    sudo cp -R * /usr/local/
    #Set the timezone
    timezone=$( sudo sed -n /TIMEZONE/p  /etc/wpa_supplicant/wpa_supplicant.conf | cut -d' ' -f 4 | sed 's/"//g')
    logger "Timezone : ${timezone}"
    sudo timedatectl set-timezone $timezone
    #Create a RAM partition to which we will write captured images to
    sudo mkdir -p /mnt/ramdisk
    echo "tmpfs /mnt/ramdisk/ tmpfs nodev,nosuid,size=50M 0 0" | sudo tee -a /etc/fstab
    #Run the application when RaspberryPi boots
    sudo echo "echo Running at boot rc.local
cd /home/pi/Desktop/rpi/RaspberrypiNodeJSApplication
npm start
    " > "/etc/rc.local"
    #Install the dependencies for the IOT application
    cd /home/pi/Desktop/rpi/RaspberrypiNodeJSApplication
    npm install
    npm start
fi

# reboot pi
/sbin/shutdown -r 1 "reboot in 1 minute"