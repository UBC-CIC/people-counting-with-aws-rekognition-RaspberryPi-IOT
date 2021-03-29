cd ~/Desktop
git clone https://github.com/UBC-CIC/DO_NOT_MAKE_PUBLIC_RPI_IOT_CAMERA.git rpi
cd ~/Desktop/iot
cp ./* ../rpi
cd ~/Desktop/rpi
mkdir certs
npm install
mv ./certificate.pem ./certs/certificate.pem
mv ./private.key ./certs/private.key
mv ./root.ca.pem ./certs/root.ca.pem