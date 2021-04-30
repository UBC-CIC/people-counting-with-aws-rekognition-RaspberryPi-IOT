// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const CONFIG = {
    // e.g. ssh-rsa AAAA.......BBBB username@example.com
    'sshPublicKey': '...',
    // Name of the secret where the Wifi password is stored
    'wifiPasswordSecretName': 'RPI_WIFI_PASSWORD',
    // Link of the project's github repository
    'githubLink': '...',
    // For more information on how to configure Wifi SSID and Country
    // see https://www.raspberrypi.org/documentation/configuration/wireless/wireless-cli.md
    'wifiCountry': 'CA',
    'wifiSsid': 'ubcvisitor',
    'timeZone': 'America/Vancouver'
};
