cd ~/Desktop
git clone https://github.com/UBC-CIC/people-counting-with-aws-rekognition-RaspberryPi-IOT.git rpi
cd ~/Desktop/iot
cp ./* ../rpi/RaspberrypiNodeJSApplication
cd ~/Desktop/rpi/RaspberrypiNodeJSApplication
mkdir certs
npm install
mv ./certificate.pem ./certs/certificate.pem
mv ./private.key ./certs/private.key
mv ./root.ca.pem ./certs/root.ca.pem