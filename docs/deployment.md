# Deployment Instructions

##Create the Raspbian image 

Follow the instructions in [README for image generation](../linuxImageSetup/README.md).

##Setup Instructions for CIC Members (For testing)
Since the repo is private for now, you need to setup the project manually. 
If it was public then you would not need to do this step.

1. Clone the repository to the Desktop folder:

```bash
cd /home/pi/Desktop/
git clone https://github.com/UBC-CIC/people-counting-with-aws-rekognition-RaspberryPi-IOT.git
``` 
2. Run the [privateSetup.sh](../RaspberrypiNodeJSApplication/privateSetup.sh) script to setup the project
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
