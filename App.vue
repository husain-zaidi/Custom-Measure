<template>
     <v-app>
        {{ message }}
        <v-content>
            <v-container>
                <v-row 
                    align="center"
                    justify="center"
                >
                    <v-col>
                        <video autoplay="true" id="video"></video>
                        <canvas id="output"></canvas>
                        <canvas id="snap1"></canvas>
                        <canvas id="snap2"></canvas>

                        <canvas id="canvas1" width="453" height="701"></canvas>
                        <canvas id="canvas2" width="453" height="701"> </canvas>
                        <img id="image1" src="img/test15.jpg" alt="">
                        <img id="image2" src="img/test16.jpg" alt="">
                    </v-col>
                </v-row>
            </v-container>
        </v-content>
    </v-app>
</template>

<script>
import * as bodyPix from '@tensorflow-models/body-pix';
import * as tf from '@tensorflow/tfjs';
import Vue from "vue";

class Pixel{
    constructor(x, y){
        this.x = x;
        this.y = y;
    }
}

var pixToCmFactor = 0;
var video;
var model; 
var canvas;
var state;
var prevFactor = 0;
var prevChestDepth = 0;

var measurements = {
    chest: 0,
    shoulder: 0,
    length: 0,
    waist: 0,
    jeansLength: 0
};

function distance(x1,y1,x2,y2){
    const distance = Math.sqrt(((x2-x1) ** 2) + ((y2-y1) ** 2));
    return distance * pixToCmFactor;
}

function distancePixel(x1,y1,x2,y2){
    const distance = Math.sqrt(((x2-x1) ** 2) + ((y2-y1) ** 2));
    return distance;
}

function isEqualArray(first, second){
    if(first.length == second.length){
        for(let i = 0; i < first.length; i++) {
            if(first[i] != second[i]) {
                return false;
            }
        }
        return true;
    }
    return false;
}

function getPixToCm(ctx,  height, leftEye, leftAnkle, mask){
    const headTop = getBlobEdge("up", {x: leftEye.position.x, y: leftEye.position.y }, mask, false);
    headTop.y++;
    const top = getBlobEdge("left", headTop, mask, false);
    const heel = getBlobEdge("left", {x: leftAnkle.position.x, y: leftAnkle.position.y }, mask, false);
    // const heel = new Pixel(leftAnkle.position.x, leftAnkle.position.y);
    const pixHeight = distancePixel(top.x, top.y, heel.x, heel.y);
    drawLine(ctx,top,heel);

    pixToCmFactor = height / pixHeight;
    //console.log("Height and factor " + pixHeight + " , " + pixToCmFactor);
}

function drawLine(ctx, start, end){
    ctx.beginPath();
    ctx.moveTo(start.x,start.y);
    ctx.lineTo(end.x,end.y);
    ctx.stroke();
}

function pixToImageDataCoord(x, y, width, height){
    return (y * width + x) * 4;
}

function getPixColor(x, y, mask){
    const i = pixToImageDataCoord(x,y,mask.width,mask.height);
    return [mask.data[i], mask.data[i+1], mask.data[i+2]];
}

function isColoured(color){
    return !((color[0] == 255) && (color[1] == 255) && (color[2] == 255));
}

function getBlobEdge(direction, origin, mask, ignoreColor){
    var currentX = Math.round(origin.x);
    var currentY = Math.round(origin.y);
   
    const originColor = getPixColor(currentX, currentY, mask);
    var currentColor = originColor;
    if(direction == "up"){
        while((isEqualArray(originColor,currentColor)) || ignoreColor && isColoured(currentColor)){
            --currentY
            currentColor = getPixColor(currentX, currentY, mask);
        }
    }else if(direction == "down"){
        while((isEqualArray(originColor,currentColor)) || ignoreColor && isColoured(currentColor)){
            ++currentY;
            currentColor = getPixColor(currentX, currentY, mask);
        }
    }else if(direction == "left"){
        while((isEqualArray(originColor,currentColor)) || ignoreColor && isColoured(currentColor)){
            --currentX;
            currentColor = getPixColor(currentX, currentY, mask);
        }
    }else if(direction == "right"){
        while((isEqualArray(originColor,currentColor)) || ignoreColor && isColoured(currentColor)){
            ++currentX;
            currentColor = getPixColor(currentX, currentY, mask);
        }
    }

    return new Pixel(currentX,currentY);
}

function getScores(segmentation, idealScore){
    if(segmentation.allPoses[0].score <= idealScore)
        return false;
    if(segmentation.allPoses[0].keypoints[5].score <= idealScore)
        return false;
    if(segmentation.allPoses[0].keypoints[6].score <= idealScore)
        return false;
    if(segmentation.allPoses[0].keypoints[1].score <= idealScore)
        return false;
    if(segmentation.allPoses[0].keypoints[15].score <= idealScore)
        return false;
    if(segmentation.allPoses[0].keypoints[11].score <= idealScore)
        return false;
    if(segmentation.allPoses[0].keypoints[7].score <= idealScore)
        return false;
    if(segmentation.allPoses[0].keypoints[0].score <= idealScore)
        return false;
    
    return true;
}

async function predict(){
    
    
    var leftShoulder;
    var rightShoulder;
    var leftEye;
    var nose;
    var leftAnkle;
    var leftHip;
    var leftElbow;
    const opacity = 0.7;
    const flipHorizontal = false;
    const maskBlurAmount = 0;

    switch(state){
        case 0:
            // person segment that shit and draw
            //front measurement
            const frontSegementation = await model.segmentPersonParts(video,{
                flipHorizontal: false,
                internalResolution: 'high',
                segmentationThreshold: 0.7
            });

            if(typeof frontSegementation.allPoses[0] !== 'undefined'){
                //calculate keypoints
                leftShoulder = frontSegementation.allPoses[0].keypoints[5];
                rightShoulder = frontSegementation.allPoses[0].keypoints[6];
                leftEye = frontSegementation.allPoses[0].keypoints[1];
                nose = frontSegementation.allPoses[0].keypoints[0];
                leftAnkle = frontSegementation.allPoses[0].keypoints[15];
                leftHip = frontSegementation.allPoses[0].keypoints[11];
                leftElbow = frontSegementation.allPoses[0].keypoints[7];
            
            
                // draw the mask
                const frontMask = bodyPix.toColoredPartMask(frontSegementation);
                bodyPix.drawMask(canvas, video, frontMask, opacity, maskBlurAmount, flipHorizontal);
            
                //Draw helpers
                var ctx = canvas.getContext('2d');
                ctx.fillRect(leftShoulder.position.x, leftShoulder.position.y, 4, 4);
                ctx.fillRect(rightShoulder.position.x, rightShoulder.position.y, 4, 4);
                ctx.fillRect(leftHip.position.x, leftHip.position.y, 4, 4);
                ctx.fillRect(leftAnkle.position.x, leftAnkle.position.y, 4, 4);
                ctx.fillRect(leftEye.position.x, leftEye.position.y, 4, 4);

                // calculate measurements if score is more that 75% and increment state
                if(getScores(frontSegementation, 0.9)){
                    getPixToCm(ctx, 167, leftEye, leftAnkle, frontMask);
                    const shoulderLeft = getBlobEdge("right", leftShoulder.position, frontMask, false);
                    const shoulderRight = getBlobEdge("left", rightShoulder.position, frontMask, false);
                    
                    drawLine(ctx, shoulderRight, shoulderLeft);
                    // measurements.shoulder = distlance(leftShoulder.position.x,leftShoulder.position.y,rightShoulder.position.x,rightShoulder.position.y);
                    measurements.shoulder = distance(shoulderLeft.x, shoulderLeft.y, shoulderRight.x, shoulderRight.y);

                    const shirtTop = getBlobEdge("up", leftHip.position, frontMask, false);
                    // const shirtBottom = getBlobEdge("down", leftHip.position, frontMask, false);
                    const shirtBottom = new Pixel(leftHip.position.x, leftHip.position.y)
                    drawLine(ctx, shirtTop, shirtBottom);
                    measurements.length = distance(shirtTop.x, shirtTop.y, shirtBottom.x, shirtBottom.y);
                    
                    var middlePoint = new Pixel((shirtTop.x + shirtBottom.x) / 2 ,  (shirtTop.y + shirtBottom.y) / 2);
                    var shirtLeft = getBlobEdge("left", middlePoint, frontMask, false);
                    var shirtRight = getBlobEdge("right", middlePoint, frontMask, false);
                    drawLine(ctx, shirtLeft, shirtRight);
                    measurements.chest = distance(shirtLeft.x, shirtLeft.y, shirtRight.x, shirtRight.y) * 2;
                    
                    
                    var leftWaist = getBlobEdge("left", leftHip.position, frontMask, false);
                    var rightWaist = getBlobEdge("right", leftHip.position, frontMask, false);
                    const waist = distance(leftWaist.x, leftWaist.y, rightWaist.x, rightWaist.y);
                    drawLine(ctx, leftWaist, rightWaist);
                    measurements.waist = waist * 2;
                    console.log(Math.abs(prevFactor - pixToCmFactor))
                    // if person is static
                    //Math.abs(prevFactor - pixToCmFactor) < 0.00001
                    if(Math.abs(prevFactor - pixToCmFactor) < 0.00001){
                        //take a snap
                        const snap1 = document.getElementById('snap1');
                        snap1.width = canvas.width;
                        snap1.height = canvas.height;
                        const snap1Ctx = snap1.getContext('2d');
                        const img = ctx.getImageData(0,0,canvas.width, canvas.height);
                        snap1Ctx.putImageData(img, 0, 0);

                        console.log(frontSegementation);
                        console.log("Shoulder: " + measurements.shoulder + " cm ");
                        console.log("Shirt Length: " + measurements.length + " cm");
                        console.log("Shirt Chest: " + measurements.chest + " cm");
                        console.log("Waist: " + measurements.waist + " cm");
                        console.log("TURN Right!");
                        state++;
                    }
                    else
                        prevFactor = pixToCmFactor;
                }
            }

            break;
        case 1:
            
            const sideSegmentation = await model.segmentPersonParts(video,{
                flipHorizontal: false,
                internalResolution: 'high',
                segmentationThreshold: 0.7
            });
            
            if(typeof sideSegmentation.allPoses[0] !== 'undefined'){
                leftShoulder = sideSegmentation.allPoses[0].keypoints[5];
                rightShoulder = sideSegmentation.allPoses[0].keypoints[6];
                const rightHip = sideSegmentation.allPoses[0].keypoints[12];
                
                const sideMask = bodyPix.toColoredPartMask(sideSegmentation);
                bodyPix.drawMask(canvas, video, sideMask, opacity, maskBlurAmount, flipHorizontal);
                
                var ctx = canvas.getContext('2d');
                ctx.fillRect(leftShoulder.position.x, leftShoulder.position.y, 2, 2);
                ctx.fillRect(rightShoulder.position.x, rightShoulder.position.y, 2, 2);
                ctx.fillRect(rightHip.position.x, rightHip.position.y, 2, 2);

                const shoulderDistance = distance(leftShoulder.position.x, leftShoulder.position.y, rightShoulder.position.x, rightShoulder.position.y)
                
                if(getScores(sideSegmentation, 0.8) && shoulderDistance < 5){
                    // calculate depth
                    leftWaist = getBlobEdge("left", rightHip.position, sideMask, true);
                    rightWaist = getBlobEdge("right", rightHip.position, sideMask, true);
                    drawLine(ctx, leftWaist, rightWaist);
                    const waitDepth = distance(leftWaist.x, leftWaist.y, rightWaist.x, rightWaist.y);
                    
                    middlePoint = new Pixel((rightShoulder.position.x + rightHip.position.x) / 2, (rightShoulder.position.y + rightHip.position.y) / 2)
                    shirtLeft = getBlobEdge("left", middlePoint, sideMask, true);
                    shirtRight = getBlobEdge("right", middlePoint, sideMask, true);
                    drawLine(ctx, shirtLeft, shirtRight);
                    const chestDepth = distance(shirtRight.x, shirtRight.y, shirtLeft.x, shirtLeft.y);
                    
                    //Draw helpers
                    ctx.fillRect(leftWaist.x, leftWaist.y, 2, 2);
                    ctx.fillRect(rightWaist.x, rightWaist.y, 2, 2);
                    console.log(Math.abs(chestDepth - prevChestDepth));
                    if(Math.abs(chestDepth - prevChestDepth) < 1){
                        //take a snap
                        const snap2 = document.getElementById('snap2');
                        snap2.width = canvas.width;
                        snap2.height = canvas.height;
                        const snap2Ctx = snap2.getContext('2d');
                        const img = ctx.getImageData(0,0,canvas.width, canvas.height);
                        snap2Ctx.putImageData(img,0,0);

                        console.log(sideSegmentation);
                        measurements.waist += waitDepth;
                        measurements.chest += chestDepth;
                        state++;
                    }
                    else 
                        prevChestDepth = chestDepth;
                }
            }
            break;
        case 2:
            console.log("Shoulder: " + measurements.shoulder + " cm ");
            console.log("Shirt Length: " + measurements.length + " cm");
            console.log("Shirt Chest: " + measurements.chest + " cm");
            console.log("Waist: " + measurements.waist + " cm");
            state++;
            break;
        case 3:
            break;
        
    }


    // predict every frame
    setTimeout(function() {
        predict();
    },33);
}

async function loadAndPredict() {
    const frontImage = document.getElementById('image1');
    const sideImage = document.getElementById('image2');
    console.info('TensorFlow.js version', tf.version['tfjs']);
    const canvas1 = document.getElementById('canvas1');
    const canvas2 = document.getElementById('canvas2');
    video = document.getElementById("video");
    canvas = document.getElementById('output');
    state = 0;
    /*{
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2,
    } */
    model = await bodyPix.load({architecture: 'MobileNetV1',
    outputStride: 16,
    multiplier: 0.75,
    quantBytes: 2});
    console.log('Model loaded');
    if(navigator.mediaDevices.getUserMedia){
        navigator.mediaDevices.getUserMedia({video: true, audio: false})
            .then(function(stream){
                video.srcObject = stream;
            })
            .catch(function(err){
                console.error("Camera error: "+err);
            })
    }

    video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    }

    // Start Video frame segmentation and Measurment
    video.onplay = () => {
        video.width = canvas.width;
        video.height = canvas.height;
        predict(video);
    }


    //Test Images
    //segment the body front
    const frontSegementation = await model.segmentPersonParts(frontImage,{
        flipHorizontal: false,
        internalResolution: 'high',
        segmentationThreshold: 0.7
    });
    
    //calculate distance
    var leftShoulder = frontSegementation.allPoses[0].keypoints[5];
    var rightShoulder = frontSegementation.allPoses[0].keypoints[6];
    var leftEye = frontSegementation.allPoses[0].keypoints[1];
    var leftAnkle = frontSegementation.allPoses[0].keypoints[15];
    var leftHip = frontSegementation.allPoses[0].keypoints[11];


    console.log(frontSegementation);

    // draw the mask
    const frontMask = bodyPix.toColoredPartMask(frontSegementation);
    const opacity = 0.7;
    const flipHorizontal = false;
    const maskBlurAmount = 0;
    bodyPix.drawMask(canvas1, frontImage, frontMask, opacity, maskBlurAmount,flipHorizontal);

    //Draw helpers
    var ctx = canvas1.getContext('2d');
    ctx.fillRect(leftShoulder.position.x, leftShoulder.position.y, 4, 4);
    ctx.fillRect(rightShoulder.position.x, rightShoulder.position.y, 4, 4);
    ctx.fillRect(leftHip.position.x, leftHip.position.y, 4, 4);
    ctx.fillRect(leftAnkle.position.x, leftAnkle.position.y, 4, 4);


    getPixToCm(ctx, 169, leftEye, leftAnkle, frontMask);


    //get measurements
    const shoulderLeft = getBlobEdge("left", leftShoulder.position, frontMask, false);
    const shoulderRight = getBlobEdge("right", rightShoulder.position, frontMask, false);
    drawLine(ctx, shoulderRight, shoulderLeft);
    // measurements.shoulder = distance(leftShoulder.position.x,leftShoulder.position.y,rightShoulder.position.x,rightShoulder.position.y);
    measurements.shoulder = distance(shoulderLeft.x, shoulderLeft.y, shoulderRight.x, shoulderRight.y);
    
    const shirtTop = getBlobEdge("up", leftHip.position, frontMask, false);
    // const shirtBottom = getBlobEdge("down", leftHip.position, frontMask, false);
    const shirtBottom = new Pixel(leftHip.position.x, leftHip.position.y);
    drawLine(ctx, shirtTop, shirtBottom);
    measurements.length = distance(shirtTop.x, shirtTop.y, shirtBottom.x, shirtBottom.y);

    var middlePoint = new Pixel((shirtTop.x + shirtBottom.x) / 2 ,  (shirtTop.y + shirtBottom.y) / 2);
    var shirtLeft = getBlobEdge("left", middlePoint, frontMask, false);
    var shirtRight = getBlobEdge("right", middlePoint, frontMask, false);
    const chest = distance(shirtLeft.x, shirtLeft.y, shirtRight.x, shirtRight.y);
    drawLine(ctx, shirtLeft, shirtRight);
    measurements.chest = chest;


    var leftWaist = getBlobEdge("left", leftHip.position, frontMask, false);
    var rightWaist = getBlobEdge("right", leftHip.position, frontMask, false);
    drawLine(ctx, leftWaist, rightWaist);
    const waist = distance(leftWaist.x, leftWaist.y, rightWaist.x, rightWaist.y);
    measurements.waist = waist;
    console.log("WAIST 1: "+ measurements.waist);
    console.log("CHEST 1: "+ measurements.chest);

    
    const sideSegmentation = await model.segmentPersonParts(sideImage,{
        flipHorizontal: false,
        internalResolution: 'high',
        segmentationThreshold: 0.7
    });
    
    leftShoulder = sideSegmentation.allPoses[0].keypoints[5];
    rightShoulder = sideSegmentation.allPoses[0].keypoints[6];
    const rightHip = sideSegmentation.allPoses[0].keypoints[12];
    
    
    const sideMask = bodyPix.toColoredPartMask(sideSegmentation);
    bodyPix.drawMask(canvas2, sideImage, sideMask, opacity, maskBlurAmount,flipHorizontal);
    
    ctx = canvas2.getContext('2d');
    ctx.fillRect(leftShoulder.position.x, leftShoulder.position.y, 4, 4);
    ctx.fillRect(rightShoulder.position.x, rightShoulder.position.y, 4, 4);
    ctx.fillRect(rightHip.position.x, rightHip.position.y, 4, 4);
   
    // calculate depth
    leftWaist = getBlobEdge("left", rightHip.position, sideMask, true);
    rightWaist = getBlobEdge("right", rightHip.position, sideMask, true);
    drawLine(ctx, leftWaist, rightWaist);
    const waistDepth = distance(leftWaist.x, leftWaist.y, rightWaist.x, rightWaist.y);
    measurements.waist += waistDepth * 2;
    
    middlePoint = new Pixel((rightShoulder.position.x + rightHip.position.x) / 2, (rightShoulder.position.y + rightHip.position.y) / 2)
    shirtLeft = getBlobEdge("left", middlePoint, sideMask, true);
    shirtRight = getBlobEdge("right", middlePoint, sideMask, true);
    drawLine(ctx, shirtLeft, shirtRight);
    const chestDepth = distance(shirtRight.x, shirtRight.y, shirtLeft.x, shirtLeft.y);
    measurements.chest += chestDepth * 2;
    
    ctx.fillRect(leftWaist.x, leftWaist.y, 4, 4);
    ctx.fillRect(rightWaist.x, rightWaist.y, 4, 4);
    
    console.log(sideSegmentation);
    
    console.log("Shoulder: "+ measurements.shoulder + " cm ");
    console.log("Shirt Length: "+ measurements.length + " cm");
    console.log("Shirt Chest: "+ measurements.chest + " cm");
    console.log("Waist: " + measurements.waist + " cm");
}

export default {
    name: "app",
    data() {
        return {
            message: "Hello world"
        }
    },
    mounted: function(){
        loadAndPredict();
    }
}
</script>

<style>
#video{
    display: none;
}
</style>