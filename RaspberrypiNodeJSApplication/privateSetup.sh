cd /home/pi/Desktop/
sudo rm -rf rpi
git clone https://github.com/UBC-CIC/people-counting-with-aws-rekognition-RaspberryPi-IOT.git rpi
cd /home/pi/Desktop/iot
sudo cp ./* /home/pi/Desktop/rpi/RaspberrypiNodeJSApplication
cd /home/pi/Desktop/rpi/RaspberrypiNodeJSApplication
mkdir certs
npm install
sudo mv ./certificate.pem ./certs/certificate.pem
sudo mv ./private.key ./certs/private.key
sudo mv ./root.ca.pem ./certs/root.ca.pem