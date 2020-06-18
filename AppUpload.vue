<template>
    <v-container>
        <v-container>
            <v-file-input show-size accept="image/*" label="Front Image" @change="uploadImage1"></v-file-input>
            <v-file-input show-size accept="image/*" label="Side Image" @change="uploadImage2"></v-file-input>
            <v-text-field 
                        label="height"
                        type="number" 
                        v-model="height"
                        dense
                        outlined 
                        class="my-5"
                        append-outer-icon="mdi-chevron-right-box" 
                        @click:append-outer="submitHeight">
            </v-text-field>
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
            </table>
            <v-btn small color="primary" v-if="done" @click="sendEmail">Send</v-btn>
        </v-container>
        <v-container>
            <canvas id="canvas1"></canvas>
            <canvas id="canvas2"></canvas>
            <img id="image1" :src="image1" />
            <img id="image2" :src="image2" />
        </v-container>
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
var model; 
var canvas;

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

function distance(x1,y1,x2,y2){
    const distance = Math.sqrt(((x2-x1) ** 2) + ((y2-y1) ** 2));
    return distance * pixToCmFactor;
}

function distancePixel(x1,y1,x2,y2){
    const distance = Math.sqrt(((x2-x1) ** 2) + ((y2-y1) ** 2));
    return distance;
}

function ellipsePerimeter(width, height){
    let h = ((width - height) ** 2) / ((width + height) ** 2);
    // return 2 * Math.PI * Math.sqrt(((width ** 2) + (height ** 2)) / 2);
    return Math.PI * (width + height) * (1 + h/4 + (h ** 2)/64 + (h ** 3)/256 + 25 * (h ** 4)/16384);
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

function drawLine(ctx, start, end, color="black"){
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

async function predict(vm){
    //Test Images
    const frontImage = document.getElementById('image1');
    const sideImage = document.getElementById('image2');
    
    const canvas1 = document.getElementById('canvas1');
    canvas1.width = frontImage.width;
    canvas1.height = frontImage.height;
    const canvas2 = document.getElementById('canvas2');
    canvas2.width = sideImage.width;
    canvas2.height = sideImage.height;

    const internalResolution = 'low';
    const segmentationThreshold = 0.7;


    var ctx = canvas1.getContext('2d');
    ctx.drawImage(frontImage,0,0);
    sharpen(ctx, frontImage.width, frontImage.height, 0.9);

    //segment the body front
    const frontSegementation = await model.segmentPersonParts(canvas1,{
        flipHorizontal: false,
        internalResolution: internalResolution,
        segmentationThreshold: segmentationThreshold,
        maxDetections: 1
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
    const opacity = 0.5;
    const flipHorizontal = false;
    const maskBlurAmount = 0;
    bodyPix.drawMask(canvas1, frontImage, frontMask, opacity, maskBlurAmount,flipHorizontal);

    //Draw helpers
    var ctx = canvas1.getContext('2d');
    ctx.fillRect(leftShoulder.position.x, leftShoulder.position.y, 4, 4);
    ctx.fillRect(rightShoulder.position.x, rightShoulder.position.y, 4, 4);
    ctx.fillRect(leftHip.position.x, leftHip.position.y, 4, 4);
    ctx.fillRect(leftAnkle.position.x, leftAnkle.position.y, 4, 4);


    getPixToCm(ctx, vm.height, leftEye, leftAnkle, frontMask);


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
    var sleeveBottom = getBlobEdge("down", sleeveTop, frontMask, false, [217, 194, 49]);
    const sleeve = distance(sleeveTop.x, sleeveTop.y, sleeveBottom.x, sleeveBottom.y);
    drawLine(ctx, sleeveTop, sleeveBottom, "black");
    measurements.sleeve = sleeve;

    const trouser = distance(leftHip.position.x, leftHip.position.y, leftAnkle.position.x, leftAnkle.position.y);
    drawLine(ctx, leftHip.position, leftAnkle.position, "red");
    measurements.trouser = trouser;

    ctx.fillRect(sleeveTop.x, sleeveTop.y, 4, 4);
    ctx.fillRect(sleeveBottom.x, sleeveBottom.y, 4, 4);
    ctx.fillRect(leftWaist.x, leftWaist.y, 2, 2);
    ctx.fillRect(rightWaist.x, rightWaist.y, 2, 2);
    ctx.fillRect(shirtTop.x, shirtTop.y, 4, 4);
    ctx.fillRect(shirtBottom.x, shirtBottom.y, 4, 4);
    
    console.log("WAIST 1: "+ measurements.waist);
    console.log("CHEST 1: "+ measurements.chest);

    var ctx = canvas2.getContext('2d');
    ctx.drawImage(sideImage,0,0);
    sharpen(ctx, frontImage.width, sideImage.height, 0.9);
    
    const sideSegmentation = await model.segmentPersonParts(canvas2,{
        flipHorizontal: false,
        internalResolution: internalResolution,
        segmentationThreshold: segmentationThreshold,
        maxDetections: 1
    });
    
    leftShoulder = sideSegmentation.allPoses[0].keypoints[5];
    rightShoulder = sideSegmentation.allPoses[0].keypoints[6];
    const rightHip = sideSegmentation.allPoses[0].keypoints[12];
    leftHip = sideSegmentation.allPoses[0].keypoints[11];
    
    const sideMask = bodyPix.toColoredPartMask(sideSegmentation);
    bodyPix.drawMask(canvas2, sideImage, sideMask, opacity, maskBlurAmount,flipHorizontal);
    
    ctx = canvas2.getContext('2d');
    ctx.fillRect(leftShoulder.position.x, leftShoulder.position.y, 4, 4);
    ctx.fillRect(rightShoulder.position.x, rightShoulder.position.y, 4, 4);
    ctx.fillRect(rightHip.position.x, rightHip.position.y, 4, 4);

    // calculate depth
    leftWaist = getBlobEdge("left", rightHip.position, sideMask, true);
    rightWaist = getBlobEdge("right", rightHip.position, sideMask, true);
    drawLine(ctx, leftWaist, rightWaist, 'black');
    const waistDepth = distance(leftWaist.x, leftWaist.y, rightWaist.x, rightWaist.y);
    
    shirtTop = getBlobEdge("up", rightShoulder.position, sideMask, false, [143,61,178]);
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


    ctx.fillRect(shirtTop.x, shirtTop.y, 6, 6);
    ctx.fillRect(leftWaist.x, leftWaist.y, 4, 4);
    ctx.fillRect(rightWaist.x, rightWaist.y, 4, 4);
    
    // measurements.waist = ellipsePerimeter(measurements.waist, waistDepth);
    // measurements.chest = ellipsePerimeter(measurements.chest, chestDepth);
    // measurements.mid = ellipsePerimeter(measurements.mid, midDepth);
    // measurements.bottom = ellipsePerimeter(measurements.bottom, bottomDepth);
    measurements.waist += waistDepth * 2;
    measurements.chest += chestDepth * 2;
    measurements.mid += midDepth * 2; 
    measurements.bottom += bottomDepth * 2;
    
    console.log("Shoulder: "+ measurements.shoulder + " cm ");
    console.log("Shirt Length: "+ measurements.length + " cm");
    console.log("Shirt Chest: "+ measurements.chest + " cm");
    console.log("Shirt Mid: "+ measurements.mid + " cm");
    console.log("Shirt Bottom: "+ measurements.bottom + " cm");
    console.log("Waist: " + measurements.waist + " cm");
    vm.done = true;
}

export default {
    data: function(){
        return {
            instruction: 'Enter your height',
            height: 169,
            image1: '',
            image2: '',
            measurements: measurements,
            done: false
        }
    },
    mounted: async function(){
        console.info('TensorFlow.js version', tf.version['tfjs']);
        console.log(tf.getBackend());

        model = await bodyPix.load();
        console.log('Model loaded');
        
    },
    methods: {
        submitHeight(){
            measurements.height = this.height;
            if(image1 != '' && image2 != '')
                predict(this);
        },    
        uploadImage1(e){
            console.log(e);
            var file = e;
            var reader = new FileReader();
            var vm = this;
            reader.onload = (e) => {
                vm.image1 = e.target.result;
            }
            reader.readAsDataURL(file);
        },
        uploadImage2(e){
            var file = e;
            var reader = new FileReader();
            var vm = this;
            reader.onload = (e) => {
                vm.image2 = e.target.result;
            }
            reader.readAsDataURL(file);
        },
        sendEmail(){
            const front = document.getElementById("canvas1");
            const side = document.getElementById("canvas2");

// onredner domain: 743a9995-175b-4c21-a321-2c0fa9117a14
// SSL all domains 37140ef3-eaf2-4869-859b-40b0c87e5b5d
// non ssl all domains: 4b888be0-f1ee-401c-874a-16a4ec73e23c
// elasticmail: f5a02a6a-714f-401c-8bf8-863e8c2715ef
//cfac9bed-ed3b-40eb-a1a3-750342677d87
            // Email.send({
            //     SecureToken: "cfac9bed-ed3b-40eb-a1a3-750342677d87",
            //     To: "husainhz7@gmail.com",
            //     From: "husainhz7@gmail.com",
            //     Subject: "Measurements",
            //     Body: "Shoulder: "+ this.measurements.shoulder + "\n" +
            //           "Shirt Length: "+ this.measurements.length + " \n" +
            //           "Shirt Chest: "+ this.measurements.chest + " \n" +
            //           "Shirt Mid: "+ this.measurements.mid + " \n" +
            //           "Shirt Bottom: "+ this.measurements.bottom + " \n" +
            //           "Waist: " + this.measurements.waist  + " \n" +
            //           "Sleeve: " + this.measurements.sleeve  + " \n" +
            //           "Trouser: " + this.measurements.trouser  + " \n",
            //     Attachments:[
            //         {
            //             name: "frontImage.jpg",
            //             data: front.toDataURL('image/png'),
            //         },
            //         {
            //             name: "sideImage.jpg",
            //             data: side.toDataURL('image/png'),
            //         }
            //     ]
            // }).then(message => console.log(message));

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
                })
                .catch(function (response) {
                    //handle error
                    console.log(response);
            });


        }
    }
    
}
</script>