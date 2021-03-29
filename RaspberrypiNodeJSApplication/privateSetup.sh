cd ~/Desktop/iot
sudo cp ./* ../people-counting-with-aws-rekognition-RaspberryPi-IOT/RaspberrypiNodeJSApplication
cd ~/Desktop/people-counting-with-aws-rekognition-RaspberryPi-IOT/RaspberrypiNodeJSApplication
mkdir certs
npm install
sudo mv ./certificate.pem ./certs/certificate.pem
sudo mv ./private.key ./certs/private.key
sudo mv ./root.ca.pem ./certs/root.ca.pem