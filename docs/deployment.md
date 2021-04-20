# Deployment Instructions

## Step 1. Create the Raspbian image 

1. To deploy the cloudformation stack that will generate the images yarn cdk bootstrap --profile YOUR_PROFILE
   
2. Follow the instructions in [../linuxImageSetup/README.md to generate the disk image](../linuxImageSetup/README.md).

3. If you have never used RaspberryPi before, make sure to familiarize yourself with the following: 

Follow the tutorial on how to setup Raspberry Pi using the components you purchased: https://projects.raspberrypi.org/en/projects/raspberry-pi-getting-started

Follow the tutorial on how to connect RaspberryPi camera to the board, take a picture and save it to a folder: https://projects.raspberrypi.org/en/projects/getting-started-with-picamera/2

4. On first start-up a shell script will setup the RaspberryPi with the necessary configuration (Generate certificates, enable camera, etc.).
You need to wait for about 2-3 minutes before it restarts automatically. After this you can continue the instructions. 
   
## Step 2. Setup Instructions for CIC Members ONLY (For testing)

Since this repo is private for now, you need to setup the project manually (have to enter git credentials to clone)
If it was public then you would not need to do this step.

1. Clone the repository to the Desktop folder:

```bash
cd /home/pi/Desktop/
git clone https://github.com/UBC-CIC/people-counting-with-aws-rekognition-RaspberryPi-IOT.git
``` 
2. Run the [privateSetup.sh](../RaspberrypiNodeJSApplication/privateSetup.sh) script to setup the project.
   The following commands will achieve this.:

```bash
cd /home/pi/Desktop/people-counting-with-aws-rekognition-RaspberryPi-IOT/RaspberrypiNodeJSApplication
chmod a+x privateSetup.sh 
sudo ./privateSetup.sh
``` 

3. Run npm start in the RaspberrypiNodeJSApplication folder:

```bash
cd /home/pi/Desktop/people-counting-with-aws-rekognition-RaspberryPi-IOT/RaspberrypiNodeJSApplication
npm start 
``` 
