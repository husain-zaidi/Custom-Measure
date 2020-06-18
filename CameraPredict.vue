<template>
<v-container >
    
        <!-- <v-container> -->
            <video autoplay="true" id="video"></video>
            <canvas id="buffer"></canvas>
            <!-- "d-flex justify-center align-center flex-column" -->
            <v-card class="d-flex justify-center align-center flex-column">
                 <v-row class="d-flex justify-center align-center">
                    <v-col cols="4" xs="3"> 
                        <v-text-field 
                            label="height"
                            type="number" 
                            v-model="height"
                            dense
                            outlined 
                            class="my-5"
                        ></v-text-field>
                    </v-col>
                    <v-col cols="5" xs="3"> 
                        <v-select
                            :items="units"
                            label="Unit"
                            :value="unit"
                            solo
                            append-outer-icon="mdi-chevron-right-box"
                            @change="changeUnit"
                             @click:append-outer="submitHeight"
                        ></v-select>
                    </v-col>
                </v-row>
                <p class="my-5">{{instruction}}</p>
                
                <canvas  id="output"></canvas>
                 <v-progress-circular
                        v-if="loading"
                        indeterminate
                        color="primary"
                ></v-progress-circular>
            </v-card>   
            <v-card  >
               
            </v-card>
            <v-card class="d-flex justify-center align-center flex-column" >
            
            <p>Measurements (In {{unit}})</p>
            <table style="width:50%">
                <tr>
                    <td>Shoulder Length: </td>
                    <td>{{measurements.shoulder.toFixed(2)}}</td>
                </tr>
                 <tr>
                    <td>Shirt Length: </td>
                    <td>{{measurements.length.toFixed(2)}}</td>
                </tr>
                 <tr>
                    <td>Chest: </td>
                    <td>{{measurements.chest.toFixed(2)}}</td>
                </tr>
                 <tr>
                    <td>Mid: </td>
                    <td>{{measurements.mid.toFixed(2)}}</td>
                </tr>
                 <tr>
                    <td>Bottom: </td>
                    <td>{{measurements.bottom.toFixed(2)}}</td>
                </tr>
                 <tr>
                    <td>Waist: </td>
                    <td>{{measurements.waist.toFixed(2)}}</td>
                </tr>
                <tr>
                    <td>Sleeve: </td>
                    <td>{{measurements.sleeve.toFixed(2)}}</td>
                </tr>
                <tr>
                    <td>Trouser: </td>
                    <td>{{measurements.trouser.toFixed(2)}}</td>
                </tr>
            </table>
            <v-btn small color="primary" v-if="done" @click="sendEmail">Send</v-btn>
            </v-card>
        <!-- </v-container> -->
        <!-- <v-container fluid> -->
            <canvas id="snap1"></canvas>
            <canvas id="snap2"></canvas>
        <!-- </v-container> -->
        
</v-container>
</template>

<script>
import * as bodyPix from '@tensorflow-models/body-pix';
import * as tf from '@tensorflow/tfjs';
import {Email} from './smtp.js';
const axios = require('axios');


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
var buffer;
var state;
var prevFactor = 0;
var prevChestDepth = 0;

var measurements = {
    height: 0,
    chest: 0,
    mid: 0,
    bottom: 0,
    shoulder: 0,
    length: 0,
    waist: 0,
    trouser: 0,
    collar: 0,
    sleeve: 0,
};

var measurementsSample = [];
var sampleCount = 0;

function distance(x1,y1,x2,y2){
    const distance = Math.sqrt(((x2-x1) ** 2) + ((y2-y1) ** 2));
    return distance * pixToCmFactor;
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function isiOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isMobile() {
  return isAndroid() || isiOS();
}

function distancePixel(x1,y1,x2,y2){
    const distance = Math.sqrt(((x2-x1) ** 2) + ((y2-y1) ** 2));
    return distance;
}

function ellipsePerimeter(width, height){
    return 2 * Math.PI * Math.sqrt(((width ** 2) + (height ** 2)) / 2);
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

function sharpen(ctx, w, h, mix) {
    var x, sx, sy, r, g, b, a, dstOff, srcOff, wt, cx, cy, scy, scx,
        weights = [0, -1, 0, -1, 5, -1, 0, -1, 0],
        katet = Math.round(Math.sqrt(weights.length)),
        half = (katet * 0.5) | 0,
        dstData = ctx.createImageData(w, h),
        dstBuff = dstData.data,
        srcBuff = ctx.getImageData(0, 0, w, h).data,
        y = h;

    while (y--) {
        x = w;
        while (x--) {
            sy = y;
            sx = x;
            dstOff = (y * w + x) * 4;
            r = 0;
            g = 0;
            b = 0;
            a = 0;

            for (cy = 0; cy < katet; cy++) {
                for (cx = 0; cx < katet; cx++) {
                    scy = sy + cy - half;
                    scx = sx + cx - half;

                    if (scy >= 0 && scy < h && scx >= 0 && scx < w) {
                        srcOff = (scy * w + scx) * 4;
                        wt = weights[cy * katet + cx];

                        r += srcBuff[srcOff] * wt;
                        g += srcBuff[srcOff + 1] * wt;
                        b += srcBuff[srcOff + 2] * wt;
                        a += srcBuff[srcOff + 3] * wt;
                    }
                }
            }

            dstBuff[dstOff] = r * mix + srcBuff[dstOff] * (1 - mix);
            dstBuff[dstOff + 1] = g * mix + srcBuff[dstOff + 1] * (1 - mix);
            dstBuff[dstOff + 2] = b * mix + srcBuff[dstOff + 2] * (1 - mix);
            dstBuff[dstOff + 3] = srcBuff[dstOff + 3];
        }
    }

    ctx.putImageData(dstData, 0, 0);
}

function getPixToCm(ctx,  height, leftEye, leftAnkle, mask){
    const headTop = getBlobEdge("up", {x: leftEye.position.x, y: leftEye.position.y }, mask, false);
    headTop.y++;
    const top = getBlobEdge("left", headTop, mask, false);
    const heel = getBlobEdge("left", {x: leftAnkle.position.x, y: leftAnkle.position.y }, mask, false);
    const pixHeight = distancePixel(top.x, top.y, heel.x, heel.y);
    drawLine(ctx,top,heel,'black');

    pixToCmFactor = height / pixHeight;
}

function drawLine(ctx, start, end, color='black'){
    ctx.strokeStyle = color;
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

function getBlobEdge(direction, origin, mask, ignoreColor=false, testColor=false){
    var currentX = Math.round(origin.x);
    var currentY = Math.round(origin.y);
   
    const originColor = getPixColor(currentX, currentY, mask);
    var currentColor = originColor;
    if(direction == "up"){
         while((isEqualArray(originColor,currentColor)) || (ignoreColor && isColoured(currentColor)) || (testColor && isColoured(currentColor) &&  !isEqualArray(testColor,currentColor))){
            --currentY
            currentColor = getPixColor(currentX, currentY, mask);
        }
    }else if(direction == "down"){
        while((isEqualArray(originColor,currentColor)) || (ignoreColor && isColoured(currentColor)) || (testColor && isColoured(currentColor) && !isEqualArray(testColor,currentColor))){
            ++currentY;
            currentColor = getPixColor(currentX, currentY, mask);
        }
    }else if(direction == "left"){
        while((isEqualArray(originColor,currentColor)) || (ignoreColor && isColoured(currentColor)) || (testColor && isColoured(currentColor) && !isEqualArray(testColor,currentColor))){
            --currentX;
            currentColor = getPixColor(currentX, currentY, mask);
        }
    }else if(direction == "right"){
        while((isEqualArray(originColor,currentColor)) || (ignoreColor && isColoured(currentColor)) || (testColor && isColoured(currentColor) && !isEqualArray(testColor,currentColor))){
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

function addMeasurements(a, b){ 
    return {
        waist: a.waist + b.waist,
        chest: a.chest + b.chest,
        length: a.length + b.length,
        mid: a.mid + b.mid,
        bottom: a.bottom + b.bottom,
        shoulder: a.shoulder + b.shoulder,
        sleeve: a.sleeve + b.sleeve,
        trouser: a.trouser + b.trouser,
    }
}


async function predictF(vm){
    
    
    var leftShoulder;
    var rightShoulder;
    var leftEye;
    var nose;
    var leftAnkle;
    var leftHip;
    var leftElbow;
    var leftWrist;
    var ctx;
    const opacity = 0.5;
    const flipHorizontal = false;
    const maskBlurAmount = 0;

    var internalResolution = 'high';
    var segmentationThreshold = 0.7;

    if(isMobile()){
        internalResolution = 'medium';
    }



    switch(state){
        case 0:
            //console.log(vm);
            break;
        case 1:
            vm.instruction = "Stand Straight and stay still, Make sure your full length is in view of camera";
            
            ctx = buffer.getContext('2d');
            ctx.drawImage(video, 0, 0);

            sharpen(ctx, buffer.width, buffer.height, 0.7);

            // person segment that shit and draw
            //front measurement
            const frontSegementation = await model.segmentPersonParts(buffer,{
                flipHorizontal: false,
                internalResolution: internalResolution,
                segmentationThreshold: segmentationThreshold,
                maxDetections: 1
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
                leftWrist = frontSegementation.allPoses[0].keypoints[9];
            
                // draw the mask
                const frontMask = bodyPix.toColoredPartMask(frontSegementation);
                bodyPix.drawMask(canvas, buffer, frontMask, opacity, maskBlurAmount, flipHorizontal);
            
                //Draw helpers
                ctx = canvas.getContext('2d');
                ctx.fillRect(leftShoulder.position.x, leftShoulder.position.y, 4, 4);
                ctx.fillRect(rightShoulder.position.x, rightShoulder.position.y, 4, 4);
                ctx.fillRect(leftHip.position.x, leftHip.position.y, 4, 4);
                ctx.fillRect(leftAnkle.position.x, leftAnkle.position.y, 4, 4);
                ctx.fillRect(leftEye.position.x, leftEye.position.y, 4, 4);

                // calculate measurements if score is more that 90% and increment state
                if(getScores(frontSegementation, 0.9)){
                    vm.instruction = "Stand Still, Measuring";
                    vm.loading = true;
                    getPixToCm(ctx, measurements.height, leftEye, leftAnkle, frontMask);
                    //get measurements
                    const shoulderLeft = getBlobEdge("right", leftShoulder.position, frontMask, false);
                    const shoulderRight = getBlobEdge("left", rightShoulder.position, frontMask, false);
                    drawLine(ctx, shoulderRight, shoulderLeft, 'black');
                    measurements.shoulder = distance(shoulderLeft.x, shoulderLeft.y, shoulderRight.x, shoulderRight.y);
                    
                    var shirtTop = getBlobEdge("up", leftHip.position, frontMask, false);
                    var shirtBottom = new Pixel(leftHip.position.x, leftHip.position.y);
                    drawLine(ctx, shirtTop, shirtBottom, 'black');
                    measurements.length = distance(shirtTop.x, shirtTop.y, shirtBottom.x, shirtBottom.y);

                    var chestPoint = new Pixel((2*shirtTop.x + shirtBottom.x) / 3 ,  (2*shirtTop.y + shirtBottom.y) / 3);
                    var shirtLeft = getBlobEdge("left", chestPoint, frontMask, false);
                    var shirtRight = getBlobEdge("right", chestPoint, frontMask, false);
                    const chest = distance(shirtLeft.x, shirtLeft.y, shirtRight.x, shirtRight.y);
                    drawLine(ctx, shirtLeft, shirtRight, 'green');
                    measurements.chest = chest ;

                    var midPoint = new Pixel((shirtTop.x + shirtBottom.x) / 2 ,  (shirtTop.y + shirtBottom.y) / 2);
                    var shirtLeft = getBlobEdge("left", midPoint, frontMask, false);
                    var shirtRight = getBlobEdge("right", midPoint, frontMask, false);
                    const mid = distance(shirtLeft.x, shirtLeft.y, shirtRight.x, shirtRight.y);
                    drawLine(ctx, shirtLeft, shirtRight, 'black');
                    measurements.mid = mid ;

                    var bottomPoint = new Pixel((shirtTop.x + 2*shirtBottom.x) / 3 ,  (shirtTop.y + 2*shirtBottom.y) / 3);
                    var shirtLeft = getBlobEdge("left", bottomPoint, frontMask, false);
                    var shirtRight = getBlobEdge("right", bottomPoint, frontMask, false);
                    const bottom = distance(shirtLeft.x, shirtLeft.y, shirtRight.x, shirtRight.y);
                    drawLine(ctx, shirtLeft, shirtRight, 'blue');
                    measurements.bottom = bottom ;


                    var leftWaist = getBlobEdge("left", leftHip.position, frontMask, false);
                    var rightWaist = getBlobEdge("right", leftHip.position, frontMask, false);
                    drawLine(ctx, leftWaist, rightWaist, 'black');
                    const waist = distance(leftWaist.x, leftWaist.y, rightWaist.x, rightWaist.y);
                    measurements.waist = waist ;

                    var sleeveTop = getBlobEdge("right", leftShoulder.position, frontMask, false);
                    // var sleeveBottom = getBlobEdge("down", sleeveTop, frontMask, false, [217, 194, 49]);
                    var sleeveBottom = new Pixel(leftWrist.position.x, leftWrist.position.y);
                    const sleeve = distance(sleeveTop.x, sleeveTop.y, sleeveBottom.x, sleeveBottom.y);
                    drawLine(ctx, sleeveTop, sleeveBottom, "black");
                    measurements.sleeve = sleeve;

                    const t = distance(leftHip.position.x, leftHip.position.y, leftAnkle.position.x, leftAnkle.position.y);
                    drawLine(ctx, leftHip.position, leftAnkle.position, "red");
                    measurements.trouser = t;

                    ctx.fillRect(sleeveTop.x, sleeveTop.y, 4, 4);
                    ctx.fillRect(sleeveBottom.x, sleeveBottom.y, 4, 4); 
                    ctx.fillRect(leftWaist.x, leftWaist.y, 2, 2);
                    ctx.fillRect(rightWaist.x, rightWaist.y, 2, 2);
                    ctx.fillRect(shirtTop.x, shirtTop.y, 4, 4);
                    ctx.fillRect(shirtBottom.x, shirtBottom.y, 4, 4);

                    // if person is static
                    //Math.abs(prevFactor - pixToCmFactor) < 0.00001
                    if(Math.abs(prevFactor - pixToCmFactor) < 0.01){
                        //record 10 measurements
                        if(measurementsSample.length < 10){
                            console.log(chest + " " + waist + " "+ mid + " "+ bottom + " " + t);
                            measurementsSample.push(Object.assign({},measurements));
                        }else{
                            //take a snap
                            console.log(frontSegementation);
                            vm.loading = false;
                            const snap1 = document.getElementById('snap1');
                            snap1.width = canvas.width;
                            snap1.height = canvas.height;
                            const snap1Ctx = snap1.getContext('2d');
                            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
                            snap1Ctx.putImageData(img, 0, 0);
                            console.log(measurementsSample);
                            console.log("TURN");
                            // console.log(frontSegementation);
                            // console.log("Shirt Chest: " + measurements.chest + " cm");
                            // console.log("Shirt Mid: "+ measurements.mid + " cm");
                            // console.log("Shirt Bottom: "+ measurements.bottom + " cm");
                            // console.log("Waist: " + measurements.waist + " cm");
                            // console.log("TURN Right!");
                            state++;
                        }
                    }
                    else
                        prevFactor = pixToCmFactor;
                }
            }

            break;
        case 2:
            vm.instruction = "Turn right ➡, make sure you're fully facing towards your right";

            ctx = buffer.getContext('2d');
            ctx.drawImage(video, 0, 0);

            sharpen(ctx, buffer.width, buffer.height, 0.7);

            const sideSegmentation = await model.segmentPersonParts(buffer,{
                flipHorizontal: false,
                internalResolution: internalResolution,
                segmentationThreshold: segmentationThreshold,
                maxDetections: 1
            });
            
            if(typeof sideSegmentation.allPoses[0] !== 'undefined'){
                leftShoulder = sideSegmentation.allPoses[0].keypoints[5];
                rightShoulder = sideSegmentation.allPoses[0].keypoints[6];
                const rightHip = sideSegmentation.allPoses[0].keypoints[12];
                leftHip = sideSegmentation.allPoses[0].keypoints[11];
                
                const sideMask = bodyPix.toColoredPartMask(sideSegmentation);
                bodyPix.drawMask(canvas, buffer, sideMask, opacity, maskBlurAmount, flipHorizontal);
                
                var ctx = canvas.getContext('2d');
                ctx.fillRect(leftShoulder.position.x, leftShoulder.position.y, 2, 2);
                ctx.fillRect(rightShoulder.position.x, rightShoulder.position.y, 2, 2);
                ctx.fillRect(rightHip.position.x, rightHip.position.y, 2, 2);

                const shoulderDistance = distance(leftShoulder.position.x, leftShoulder.position.y, rightShoulder.position.x, rightShoulder.position.y)
                
                if(getScores(sideSegmentation, 0.7) && shoulderDistance < 6){
                    vm.instruction = "Stand Still, Measuring";
                    vm.loading = true;
                    // calculate depth
                    leftWaist = getBlobEdge("left", rightHip.position, sideMask, true);
                    rightWaist = getBlobEdge("right", rightHip.position, sideMask, true);
                    drawLine(ctx, leftWaist, rightWaist, 'black');
                    const waistDepth = distance(leftWaist.x, leftWaist.y, rightWaist.x, rightWaist.y);
                    
                    shirtTop = getBlobEdge("up", rightShoulder.position, sideMask, false, [110,64,170]);
                    shirtBottom = new Pixel(rightHip.position.x, rightHip.position.y);


                    var chestPoint = new Pixel((2*shirtTop.x + shirtBottom.x) / 3 ,  (2*shirtTop.y + shirtBottom.y) / 3);
                    var shirtLeft = getBlobEdge("left", chestPoint, sideMask, true);
                    var shirtRight = getBlobEdge("right", chestPoint, sideMask, true);
                    const chestDepth = distance(shirtLeft.x, shirtLeft.y, shirtRight.x, shirtRight.y);
                    drawLine(ctx, shirtLeft, shirtRight, 'green');

                    var midPoint = new Pixel((shirtTop.x + shirtBottom.x) / 2 ,  (shirtTop.y + shirtBottom.y) / 2);
                    var shirtLeft = getBlobEdge("left", midPoint, sideMask, true);
                    var shirtRight = getBlobEdge("right", midPoint, sideMask, true);
                    const midDepth = distance(shirtLeft.x, shirtLeft.y, shirtRight.x, shirtRight.y);
                    drawLine(ctx, shirtLeft, shirtRight, 'black');
                    

                    var bottomPoint = new Pixel((shirtTop.x + 2*shirtBottom.x) / 3 ,  (shirtTop.y + 2*shirtBottom.y) / 3);
                    var shirtLeft = getBlobEdge("left", bottomPoint, sideMask, true);
                    var shirtRight = getBlobEdge("right", bottomPoint, sideMask, true);
                    const bottomDepth = distance(shirtLeft.x, shirtLeft.y, shirtRight.x, shirtRight.y);
                    drawLine(ctx, shirtLeft, shirtRight, 'blue');

                    //Draw helpers
                    ctx.fillRect(leftWaist.x, leftWaist.y, 2, 2);
                    ctx.fillRect(rightWaist.x, rightWaist.y, 2, 2);
                    ctx.fillRect(shirtTop.x, shirtTop.y, 4, 4);
                    ctx.fillRect(shirtBottom.x, shirtBottom.y, 4, 4);

                    if(Math.abs(chestDepth - prevChestDepth) < 1){
                        if(sampleCount < 10){
                            // measurementsSample[sampleCount].waist = ellipsePerimeter(waistDepth, measurementsSample[sampleCount].waist);
                            // measurementsSample[sampleCount].chest = ellipsePerimeter(chestDepth, measurementsSample[sampleCount].chest);
                            // measurementsSample[sampleCount].mid = ellipsePerimeter(midDepth, measurementsSample[sampleCount].mid);
                            // measurementsSample[sampleCount].bottom = ellipsePerimeter(bottomDepth, measurementsSample[sampleCount].bottom);
                            
                            console.log(chestDepth + " " +waistDepth + " " +  midDepth + " " + bottomDepth);

                            measurementsSample[sampleCount].waist += waistDepth * 2;
                            measurementsSample[sampleCount].chest += chestDepth * 2;
                            measurementsSample[sampleCount].mid += midDepth * 2;
                            measurementsSample[sampleCount].bottom += bottomDepth * 2;
                            sampleCount++;
                        }else {
                            vm.loading = false;
                            //take a snap
                            const snap2 = document.getElementById('snap2');
                            snap2.width = canvas.width;
                            snap2.height = canvas.height;
                            const snap2Ctx = snap2.getContext('2d');
                            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
                            snap2Ctx.putImageData(img, 0, 0);
                            console.log(measurementsSample);
                            // console.log(sideSegmentation);
                            // measurements.waist += waistDepth * 2;
                            // measurements.chest += chestDepth * 2;
                            // measurements.mid += midDepth * 2;
                            // measurements.bottom += bottomDepth * 2;
                            state++;
                        }
                    }
                    else 
                        prevChestDepth = chestDepth;
                }
            }
            break;
        case 3:
            vm.instruction = "Your measurements are complete!";
            console.log(measurementsSample);
            //average out
            var m = measurementsSample.reduce(addMeasurements, {height: 0,
                chest: 0,
                mid: 0,
                bottom: 0,
                shoulder: 0,
                length: 0,
                waist: 0,
                trouser: 0,
                collar: 0,
                sleeve: 0,});
            
            console.log(m);
            measurements.shoulder = m.shoulder / measurementsSample.length;
            measurements.length = m.length / measurementsSample.length;
            measurements.chest = m.chest / measurementsSample.length;
            measurements.mid = m.mid / measurementsSample.length;
            measurements.bottom = m.bottom / measurementsSample.length;
            measurements.waist = m.waist / measurementsSample.length;
            measurements.sleeve = m.sleeve / measurementsSample.length;
            measurements.trouser = m.trouser / measurementsSample.length;


            console.log("Shoulder: "+ measurements.shoulder + " cm ");
            console.log("Shirt Length: "+ measurements.length + " cm");
            console.log("Shirt Chest: "+ measurements.chest + " cm");
            console.log("Shirt Mid: "+ measurements.mid + " cm");
            console.log("Shirt Bottom: "+ measurements.bottom + " cm");
            console.log("Waist: " + measurements.waist  + " cm");
            console.log("Sleeve: " + measurements.sleeve  + " cm");
            console.log("Trouser: " + measurements.trouser  + " cm");
            
            vm.done = true;
            state++;
            break;
        case 4:
            break;
        
    }


    // predict every frame
    setTimeout(function() {
        predictF(vm);
    },33);
}

export default {
    data: function() {
        return {
            instruction: 'Enter your height',
            height: 169,
            measurements: measurements,
            units: ['Inches','Centimeters'],
            unit: 'Centimeters',
            loading: true,
            done: false,
        }
    },
    mounted: async function(){
        console.info('TensorFlow.js version', tf.version['tfjs']);
        console.log(tf.getBackend());
        video = document.getElementById("video");
        canvas = document.getElementById('output');
        buffer = document.getElementById("buffer");
            
        state = 0;
        /*{
            architecture: 'ResNet50',
            outputStride: 32,
            quantBytes: 2
        } */
        model = await bodyPix.load();
        console.log('Model loaded');
        if(navigator.mediaDevices.getUserMedia){
            navigator.mediaDevices.getUserMedia({video: {facingMode: { exact: "user" }}, audio: false})
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
            buffer.width = video.videoWidth;
            buffer.height = video.videoHeight;
        }

        // Start Video frame segmentation and Measurment
        video.onplay = () => {
            video.width = canvas.width;
            video.height = canvas.height;
            this.loading = false;
            predictF(this);
        }
    },
    methods: {
        submitHeight(e){
            measurements.height = this.height;
            console.log(this.unit);
            state++;
        },    
        changeUnit(e){
            this.unit = e;
        },
        sendEmail(){
            const front = document.getElementById("snap1");
            const side = document.getElementById("snap2");

            this.loading = true;
            
            var formdata = new FormData();
            formdata.set('measurements',"Shoulder: "+ this.measurements.shoulder + "\n" +
                      "Shirt Length: "+ this.measurements.length + " \n" +
                      "Shirt Chest: "+ this.measurements.chest + " \n" +
                      "Shirt Mid: "+ this.measurements.mid + " \n" +
                      "Shirt Bottom: "+ this.measurements.bottom + " \n" +
                      "Waist: " + this.measurements.waist  + " \n" +
                      "Sleeve: " + this.measurements.sleeve  + " \n" +
                      "Trouser: " + this.measurements.trouser  + " \n" + "In "+ this.unit + "\n");
            front.toBlob(function (blob) {
                    var newImg = document.createElement('img'),
                    url = URL.createObjectURL(blob);
                    newImg.src = url;
                    formdata.append('frontImage', newImg); 
                }
            );

            side.toBlob(function (blob) {
                    var newImg = document.createElement('img'),
                    url = URL.createObjectURL(blob);
                    newImg.src = url;
                    formdata.append('sideImage', newImg); 
                }
            );
                
            axios({
                method: 'post',
                url: 'https://husainzaidi.studio:5000/',
                data: formdata,
                headers: {'Content-Type': 'multipart/form-data' }
                })
                .then(function (response) {
                    //handle success
                    console.log(response);
                    this.loading = false;
                })
                .catch(function (response) {
                    //handle error
                    console.log(response);
                    this.loading = false;
            });
        }
    },
    
}
</script>


<style>
#video{
    display: none;
}
#buffer{
    display: none;
}
td {
    text-align: center;
}
</style>