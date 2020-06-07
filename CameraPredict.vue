<template>
<v-container class="fill-height" >
        <v-container>
            <video autoplay="true" id="video"></video>
            <v-card class="d-flex justify-center align-center flex-column">
                <p class="my-5">{{instruction}}</p>
                <canvas  id="output"></canvas>
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
            </v-card>   
            <v-card class="d-flex justify-center align-center flex-column">
<pre>
Shoulder Length: {{measurements.shoulder}} cm
Shirt Length:    {{measurements.length}} cm
Chest:           {{measurements.chest}} cm
Mid:             {{measurements.mid}} cm
Bottom:          {{measurements.bottom}} cm
Waist:           {{measurements.waist}} cm
</pre>
            
            </v-card>
        </v-container>
        <v-container fluid>
            <canvas id="snap1"></canvas>
            <canvas id="snap2"></canvas>
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
var video;
var model; 
var canvas;
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
    jeansLength: 0
};

var measurementsSample = [];
var sampleCount = 0;

function distance(x1,y1,x2,y2){
    const distance = Math.sqrt(((x2-x1) ** 2) + ((y2-y1) ** 2));
    return distance * pixToCmFactor;
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
   // return ((color[0] == 255) && (color[1] == 255) && (color[2] == 255));
}

function getBlobEdge(direction, origin, mask, ignoreColor){
    var currentX = Math.round(origin.x);
    var currentY = Math.round(origin.y);
   
    const originColor = getPixColor(currentX, currentY, mask);
    var currentColor = originColor;
    if(direction == "up"){
        while((isEqualArray(originColor,currentColor)) && isColoured(currentColor) || ignoreColor && isColoured(currentColor)){
            --currentY
            currentColor = getPixColor(currentX, currentY, mask);
        }
    }else if(direction == "down"){
        while((isEqualArray(originColor,currentColor)) && isColoured(currentColor) || ignoreColor && isColoured(currentColor)){
            ++currentY;
            currentColor = getPixColor(currentX, currentY, mask);
        }
    }else if(direction == "left"){
        while((isEqualArray(originColor,currentColor)) && isColoured(currentColor) || ignoreColor && isColoured(currentColor)){
            --currentX;
            currentColor = getPixColor(currentX, currentY, mask);
        }
    }else if(direction == "right"){
        while((isEqualArray(originColor,currentColor)) && isColoured(currentColor) || ignoreColor && isColoured(currentColor)){
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
    const opacity = 0.5;
    const flipHorizontal = false;
    const maskBlurAmount = 0;

    const internalResolution = 'medium';
    const segmentationThreshold = 0.7;


    switch(state){
        case 0:
            //console.log(vm);
            break;
        case 1:
            vm.instruction = "Stand Straight and stay still, Make sure your full length is in view of camera";
            // person segment that shit and draw
            //front measurement
            const frontSegementation = await model.segmentPersonParts(video,{
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
                    getPixToCm(ctx, measurements.height, leftEye, leftAnkle, frontMask);
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
                    

                    // if person is static
                    //Math.abs(prevFactor - pixToCmFactor) < 0.00001
                    if(Math.abs(prevFactor - pixToCmFactor) < 0.001){
                        //record 30 measurements
                        if(measurementsSample.length < 10){
                            measurementsSample.push(Object.assign({},measurements));
                        }else{
                            //take a snap
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
            const sideSegmentation = await model.segmentPersonParts(video,{
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
                bodyPix.drawMask(canvas, video, sideMask, opacity, maskBlurAmount, flipHorizontal);
                
                var ctx = canvas.getContext('2d');
                ctx.fillRect(leftShoulder.position.x, leftShoulder.position.y, 2, 2);
                ctx.fillRect(rightShoulder.position.x, rightShoulder.position.y, 2, 2);
                ctx.fillRect(rightHip.position.x, rightHip.position.y, 2, 2);

                const shoulderDistance = distance(leftShoulder.position.x, leftShoulder.position.y, rightShoulder.position.x, rightShoulder.position.y)
                
                if(getScores(sideSegmentation, 0.8) && shoulderDistance < 6){
                    // calculate depth
                    leftWaist = getBlobEdge("left", rightHip.position, sideMask, true);
                    rightWaist = getBlobEdge("right", rightHip.position, sideMask, true);
                    drawLine(ctx, leftWaist, rightWaist);
                    const waistDepth = distance(leftWaist.x, leftWaist.y, rightWaist.x, rightWaist.y);
                    
                    shirtTop = getBlobEdge("up", leftShoulder.position, sideMask, false);
                    shirtBottom = new Pixel(rightHip.position.x, rightHip.position.y);


                    var chestPoint = new Pixel((2*shirtTop.x + shirtBottom.x) / 3 ,  (2*shirtTop.y + shirtBottom.y) / 3);
                    var shirtLeft = getBlobEdge("left", chestPoint, sideMask, true);
                    var shirtRight = getBlobEdge("right", chestPoint, sideMask, true);
                    const chestDepth = distance(shirtLeft.x, shirtLeft.y, shirtRight.x, shirtRight.y);
                    drawLine(ctx, shirtLeft, shirtRight);

                    var midPoint = new Pixel((shirtTop.x + shirtBottom.x) / 2 ,  (shirtTop.y + shirtBottom.y) / 2);
                    var shirtLeft = getBlobEdge("left", midPoint, sideMask, true);
                    var shirtRight = getBlobEdge("right", midPoint, sideMask, true);
                    const midDepth = distance(shirtLeft.x, shirtLeft.y, shirtRight.x, shirtRight.y);
                    drawLine(ctx, shirtLeft, shirtRight);
                    

                    var bottomPoint = new Pixel((shirtTop.x + 2*shirtBottom.x) / 3 ,  (shirtTop.y + 2*shirtBottom.y) / 3);
                    var shirtLeft = getBlobEdge("left", bottomPoint, sideMask, true);
                    var shirtRight = getBlobEdge("right", bottomPoint, sideMask, true);
                    const bottomDepth = distance(shirtLeft.x, shirtLeft.y, shirtRight.x, shirtRight.y);
                    drawLine(ctx, shirtLeft, shirtRight);

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
                            

                            measurementsSample[sampleCount].waist += waistDepth * 2;
                            measurementsSample[sampleCount].chest += chestDepth * 2;
                            measurementsSample[sampleCount].mid += midDepth * 2;
                            measurementsSample[sampleCount].bottom += bottomDepth * 2;
                            sampleCount++;
                        }else {

                            //take a snap
                            const snap2 = document.getElementById('snap2');
                            snap2.width = canvas.width;
                            snap2.height = canvas.height;
                            const snap2Ctx = snap2.getContext('2d');
                            const img = ctx.getImageData(0,0,canvas.width, canvas.height);
                            snap2Ctx.putImageData(img,0,0);
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
                jeansLength: 0});
            
            console.log(m);
            measurements.shoulder = m.shoulder / measurementsSample.length;
            measurements.length = m.length / measurementsSample.length;
            measurements.chest = m.chest / measurementsSample.length;
            measurements.mid = m.mid / measurementsSample.length;
            measurements.bottom = m.bottom / measurementsSample.length;
            measurements.waist = m.waist / measurementsSample.length;


            console.log("Shoulder: "+ measurements.shoulder + " cm ");
            console.log("Shirt Length: "+ measurements.length + " cm");
            console.log("Shirt Chest: "+ measurements.chest + " cm");
            console.log("Shirt Mid: "+ measurements.mid + " cm");
            console.log("Shirt Bottom: "+ measurements.bottom + " cm");
            console.log("Waist: " + measurements.waist  + " cm");
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
            measurements: measurements
        }
    },
    mounted: async function(){
        console.info('TensorFlow.js version', tf.version['tfjs']);
        console.log(tf.getBackend());
        video = document.getElementById("video");
        canvas = document.getElementById('output');
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
        }

        // Start Video frame segmentation and Measurment
        video.onplay = () => {
            video.width = canvas.width;
            video.height = canvas.height;
            
            predictF(this);
        }
    },
    methods: {
        submitHeight(){
            measurements.height = this.height;
            console.log(measurements.height);
            state++;
        },    
    },
    
}
</script>


<style>
#video{
    display: none;
}
</style>