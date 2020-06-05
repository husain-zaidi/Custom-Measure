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
<pre>
Shoulder Length: {{measurements.shoulder}} cm
Shirt Length:    {{measurements.length}} cm
Chest:           {{measurements.chest}} cm
Mid:             {{measurements.mid}} cm
Bottom:          {{measurements.bottom}} cm
Waist:           {{measurements.waist}} cm
</pre>
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

async function predict(vm){
    //Test Images
    const frontImage = document.getElementById('image1');
    const sideImage = document.getElementById('image2');
    
    const canvas1 = document.getElementById('canvas1');
    const canvas2 = document.getElementById('canvas2');

    const internalResolution = 'medium';
    const segmentationThreshold = 0.7

    //segment the body front
    const frontSegementation = await model.segmentPersonParts(frontImage,{
        flipHorizontal: false,
        internalResolution: internalResolution,
        segmentationThreshold: segmentationThreshold
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
    drawLine(ctx, shoulderRight, shoulderLeft);
    measurements.shoulder = distance(shoulderLeft.x, shoulderLeft.y, shoulderRight.x, shoulderRight.y);
    
    var shirtTop = getBlobEdge("up", leftHip.position, frontMask, false);
    var shirtBottom = new Pixel(leftHip.position.x, leftHip.position.y);
    drawLine(ctx, shirtTop, shirtBottom);
    measurements.length = distance(shirtTop.x, shirtTop.y, shirtBottom.x, shirtBottom.y);

    var chestPoint = new Pixel((2*shirtTop.x + shirtBottom.x) / 3 ,  (2*shirtTop.y + shirtBottom.y) / 3);
    var shirtLeft = getBlobEdge("left", chestPoint, frontMask, false);
    var shirtRight = getBlobEdge("right", chestPoint, frontMask, false);
    const chest = distance(shirtLeft.x, shirtLeft.y, shirtRight.x, shirtRight.y);
    drawLine(ctx, shirtLeft, shirtRight);
    measurements.chest = chest ;

    var midPoint = new Pixel((shirtTop.x + shirtBottom.x) / 2 ,  (shirtTop.y + shirtBottom.y) / 2);
    var shirtLeft = getBlobEdge("left", midPoint, frontMask, false);
    var shirtRight = getBlobEdge("right", midPoint, frontMask, false);
    const mid = distance(shirtLeft.x, shirtLeft.y, shirtRight.x, shirtRight.y);
    drawLine(ctx, shirtLeft, shirtRight);
    measurements.mid = mid ;

    var bottomPoint = new Pixel((shirtTop.x + 2*shirtBottom.x) / 3 ,  (shirtTop.y + 2*shirtBottom.y) / 3);
    var shirtLeft = getBlobEdge("left", bottomPoint, frontMask, false);
    var shirtRight = getBlobEdge("right", bottomPoint, frontMask, false);
    const bottom = distance(shirtLeft.x, shirtLeft.y, shirtRight.x, shirtRight.y);
    drawLine(ctx, shirtLeft, shirtRight);
    measurements.bottom = bottom ;


    var leftWaist = getBlobEdge("left", leftHip.position, frontMask, false);
    var rightWaist = getBlobEdge("right", leftHip.position, frontMask, false);
    drawLine(ctx, leftWaist, rightWaist);
    const waist = distance(leftWaist.x, leftWaist.y, rightWaist.x, rightWaist.y);
    measurements.waist = waist ;
    
    console.log("WAIST 1: "+ measurements.waist);
    console.log("CHEST 1: "+ measurements.chest);

    
    const sideSegmentation = await model.segmentPersonParts(sideImage,{
        flipHorizontal: false,
        internalResolution: internalResolution,
        segmentationThreshold: segmentationThreshold
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
    drawLine(ctx, leftWaist, rightWaist);
    const waistDepth = distance(leftWaist.x, leftWaist.y, rightWaist.x, rightWaist.y);
    measurements.waist += waistDepth * 2;
    
    shirtTop = getBlobEdge("up", leftShoulder.position, sideMask, false);
    shirtBottom = new Pixel(rightHip.position.x, rightHip.position.y);


    var chestPoint = new Pixel((2*shirtTop.x + shirtBottom.x) / 3 ,  (2*shirtTop.y + shirtBottom.y) / 3);
    var shirtLeft = getBlobEdge("left", chestPoint, sideMask, true);
    var shirtRight = getBlobEdge("right", chestPoint, sideMask, true);
    const chestDepth = distance(shirtLeft.x, shirtLeft.y, shirtRight.x, shirtRight.y);
    drawLine(ctx, shirtLeft, shirtRight);
    measurements.chest += chestDepth * 2;

    var midPoint = new Pixel((shirtTop.x + shirtBottom.x) / 2 ,  (shirtTop.y + shirtBottom.y) / 2);
    var shirtLeft = getBlobEdge("left", midPoint, sideMask, true);
    var shirtRight = getBlobEdge("right", midPoint, sideMask, true);
    const midDepth = distance(shirtLeft.x, shirtLeft.y, shirtRight.x, shirtRight.y);
    drawLine(ctx, shirtLeft, shirtRight);
    measurements.mid += midDepth * 2;

    var bottomPoint = new Pixel((shirtTop.x + 2*shirtBottom.x) / 3 ,  (shirtTop.y + 2*shirtBottom.y) / 3);
    var shirtLeft = getBlobEdge("left", bottomPoint, sideMask, true);
    var shirtRight = getBlobEdge("right", bottomPoint, sideMask, true);
    const bottomDepth = distance(shirtLeft.x, shirtLeft.y, shirtRight.x, shirtRight.y);
    drawLine(ctx, shirtLeft, shirtRight);
    measurements.bottom += bottomDepth * 2;

    ctx.fillRect(shirtTop.x, shirtTop.y, 6, 6);
    ctx.fillRect(leftWaist.x, leftWaist.y, 4, 4);
    ctx.fillRect(rightWaist.x, rightWaist.y, 4, 4);
    
    
    console.log("Shoulder: "+ measurements.shoulder + " cm ");
    console.log("Shirt Length: "+ measurements.length + " cm");
    console.log("Shirt Chest: "+ measurements.chest + " cm");
    console.log("Shirt Mid: "+ measurements.mid + " cm");
    console.log("Shirt Bottom: "+ measurements.bottom + " cm");
    console.log("Waist: " + measurements.waist + " cm");
}

export default {
    data: function(){
        return {
            instruction: 'Enter your height',
            height: 169,
            image1: '',
            image2: '',
            measurements: measurements
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
        }
    }
    
}
</script>