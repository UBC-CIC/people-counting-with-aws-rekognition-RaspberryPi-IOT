# Deployment Instructions

## Step 1. Create the Raspbian image 

1. Follow the instructions in [../linuxImageSetup/README.md to generate the disk image](../linuxImageSetup/README.md).

2. If you have never used RaspberryPi before, make sure to familiarize yourself with the following: 

Follow the tutorial on how to setup Raspberry Pi using the components you purchased: https://projects.raspberrypi.org/en/projects/raspberry-pi-getting-started

Follow the tutorial on how to connect RaspberryPi camera to the board, take a picture and save it to a folder: https://projects.raspberrypi.org/en/projects/getting-started-with-picamera/2

3. On first start-up a shell script will setup the RaspberryPi with the necessary configuration (Generate certificates, enable camera, etc.).
You need to wait for about 2-3 minutes before it restarts automatically. After this you can continue the instructions.
