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
    mkdir /home/pi/Desktop/iot
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

    cd /home/pi/Desktop
    ATTEMPT=0
    while [ $ATTEMPT -le 4 ]; do
          ATTEMPT=$(( $ATTEMPT + 1 ))
          logger "Waiting for git clone (ATTEMPT: $ATTEMPT)..."
          if ! git clone https://github.com/UBC-CIC/vch-mri.git rpi
          then
            logger ":---Clone failed:---"
          else
            logger ":---Clone success:---"
            break
          fi
          sleep 5
    done
    cd /home/pi/Desktop/iot
    cp ./* ../rpi
    cd /home/pi/Desktop/rpi
    mkdir certs
    # npm install
    mv ./certificate.pem ./certs/certificate.pem
    mv ./private.key ./certs/private.key
    mv ./root.ca.pem ./certs/root.ca.pem
    logger "Installing nvm ..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
fi

# reboot pi
/sbin/shutdown -r 1 "reboot in 1 minute"