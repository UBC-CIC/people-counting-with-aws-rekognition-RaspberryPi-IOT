var awsIot = require('aws-iot-device-sdk');
var colors = require('colors');
var request = require("request");
var config = require('./device.json');
const PiCamera = require('pi-camera');
const fs = require('fs');

var intervalIDs = []

const filePath = `./${config.clientId}`;
const imageCacheKey = `${config.clientId}.jpg`
const controlImageKey = `public/${config.clientId}.jpg`
const deviceTopic = config.topicGetSignedURL + "-" + config.clientId
const imageCacheCamera = new PiCamera({
	mode: 'photo',
	output: `${ __dirname }/${config.clientId}`,
	width: config.state.photoWidth,
	height: config.state.photoHeight,
	nopreview: true,
});
/**
 * Initialize the IoT device with a random clientID.
 * This will use the configuration variables stored
 * in the device.json file.
 */
var device = awsIot.thingShadow({
	keyPath: config.certs.keyPath,
	certPath: config.certs.certPath,
	caPath: config.certs.caPath,
	clientId: config.clientId,
	host: config.host
});

async function updateDeviceConfiguration(delta) {
	//save the updated settings file
	if(delta["state"]) {
		for (var key in delta["state"]){
			config.state[key] = delta["state"][key]
		}
		console.log("updateDeviceConfiguration", config.state)
		//write the new configuration and restart the application
		var data = JSON.stringify(config, null, 2);
		await fs.writeFile('./device.json', data, ()=>{});
	}
}

function restart() {
	setTimeout(function () {
		// When NodeJS exits
		process.on("exit", function () {
			require("child_process").spawn(process.argv.shift(), process.argv, {
				cwd: process.cwd(),
				detached : true,
				stdio: "inherit"
			});
		});
		process.exit();
	}, 1000);
}

function setupIoT() {
	// Connect to AWS IoT.
	console.log('Connecting to AWS IoT...'.blue);
	device.on('connect', function () {
		console.log('Connected to AWS IoT.'.blue);
		device.register(config.clientId, {}, function() {
			const curState = {
				"state" : {
					"reported" : config.state
				}
			}
			let clientTokenUpdate = device.update(config.clientId, curState);
			if (clientTokenUpdate === null)
			{
				console.log('update shadow failed, operation still in progress');
			}
			device.subscribe(config.topicSendControlImage)
			device.subscribe(deviceTopic)
			for (let el in intervalIDs){
				clearInterval(el)
			}
			intervalIDs = []
			const bucketLogicalName = "imageCache"
			const id = setInterval(() => {
				getSignedUrl(bucketLogicalName, imageCacheKey)
			}, config.state.samplingRate * 1000)
			intervalIDs.push(id)
		});
	});

	device.on('message', function(topic, payload) {
		console.log('message', topic);
		if(topic === config.topicSendControlImage){
			const bucketLogicalName = "controlBucket"
			getSignedUrl(bucketLogicalName, controlImageKey)
		} else if(topic === deviceTopic){
			console.log("payload", payload.toString())
			let jsonObj = JSON.parse(payload.toString())
			sendImage(filePath, jsonObj["url"])
		}
	});


	device.on('error', (error) => {
		console.log(error.message)
	});

	device.on('status',
		function (thingName, stat, clientToken, stateObject) {
			console.log("onstatus", stateObject)
			if(stateObject["state"] && stateObject["state"]["desired"]) {
				config.state = stateObject["state"]["desired"]
				console.log(config.state)
			}
		});

	device.on('delta',
		function(thingName, stateObject) {
			console.log('received delta on '+thingName+': '+
				JSON.stringify(stateObject));
			updateDeviceConfiguration(stateObject).then(() => {restart()})
		});
}

async function uploadToS3(response, filePath){
	console.log("uploadToS3", response, filePath)
	await fs.readFile(filePath, function(err, content) {
		if (err) {
			console.log(err)
			return;
		}
		uploadFileToS3(response, content)
	});
}

function withinTimeFrame() {
	let d = new Date();
	console.log("hour", d.getHours(), "min : ", d.getMinutes(), "sec : ", d.getSeconds())
	let beginH = parseInt(String(config.state.beginHour).split(":")[0])
	let beginM = parseInt(String(config.state.beginHour).split(":")[1])
	let endH = parseInt(String(config.state.endHour).split(":")[0])
	let endM = parseInt(String(config.state.endHour).split(":")[1])
	let beginD = new Date();
	beginD.setMinutes(beginM)
	beginD.setHours(beginH)
	let endD = new Date();
	endD.setMinutes(endM)
	endD.setHours(endH)
	let endUnixTime = endD.getTime();
	let beginUnixTime = beginD.getTime();
	let nowUnixTime = d.getTime();
	if(nowUnixTime < endUnixTime && nowUnixTime > beginUnixTime){
		return true
	}
	return false
}

function getSignedUrl(bucketLogicalName, key) {
	console.log("getSignedURL", bucketLogicalName, key)
	if(bucketLogicalName === "imageCache" && withinTimeFrame()){
		console.log("do not update Image Cache")
		return
	}
	const params = {
		deviceID : config.clientId,
		bucketLogicalName : bucketLogicalName,
		key : key
	}
	device.publish(config.topicGetSignedURL, JSON.stringify(params))
}

function sendImage(filePath, response) {

	imageCacheCamera.snap()
		.then((result) => {
			console.log("image captured")
			uploadToS3(response, filePath)
		})
		.catch((error) => {
			console.log("ERROR", error)
		});
}


function uploadFileToS3(response, content) {
	var options = {
		method: 'POST',
		url: response.url,
		formData: {
			...response.fields,
			file: content
		}
	}
	request(options, (error, response, body) => {
		if (error) throw new Error(error);
		console.log(body);
	});
}

setupIoT()

