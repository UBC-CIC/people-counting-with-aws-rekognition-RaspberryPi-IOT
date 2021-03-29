cd /home/pi/Desktop/iot
sudo cp ./* /home/pi/Desktop/people-counting-with-aws-rekognition-RaspberryPi-IOT/RaspberrypiNodeJSApplication
cd /home/pi/Desktop/people-counting-with-aws-rekognition-RaspberryPi-IOT/RaspberrypiNodeJSApplication
mkdir certs
npm install
sudo mv ./certificate.pem ./certs/certificate.pem
sudo mv ./private.key ./certs/private.key
sudo mv ./root.ca.pem ./certs/root.ca.pem