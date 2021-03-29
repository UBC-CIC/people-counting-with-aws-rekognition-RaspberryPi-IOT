# Deployment Instructions

## Create the Raspbian image 

1. Follow the instructions in [../linuxImageSetup/README.md to generate the disk image](../linuxImageSetup/README.md).

2. Burn the disk image from the previous step onto the SD Card of your RaspberryPi. You can use "Rasbperry Pi Imager" to accomplish this:
Download link : https://www.raspberrypi.org/software/

## Setup Instructions for CIC Members ONLY (For testing)

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
