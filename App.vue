<template>
     <v-app>
        <v-app-bar dense app>
            <v-toolbar-title class="font-black"><h3>Custom Measure</h3></v-toolbar-title>

        </v-app-bar>
        <v-content>
            <!-- <v-tabs>
                <v-tab>App</v-tab>
                <v-tab>Upload Data</v-tab>
                <v-tab-item> -->
                    <v-stepper v-model="currentStep">
                        <v-stepper-header>
                            <v-stepper-step :complete="currentStep > 1" step="1">Welcome</v-stepper-step>
                            <v-divider></v-divider>
                            <v-stepper-step :complete="currentStep > 2" step="2">Lights & Clothes</v-stepper-step>
                            <v-divider></v-divider>
                            <v-stepper-step :complete="currentStep > 3" step="3">Camera</v-stepper-step>
                            <v-divider></v-divider>
                            <v-stepper-step :complete="currentStep > 4" step="4">Steps</v-stepper-step>
                            <v-divider></v-divider>
                            <v-stepper-step step="5">Measure</v-stepper-step>
                        </v-stepper-header>

                        <v-stepper-items>
                            <v-stepper-content step="1">
                                <v-card min-height="400px" class="d-flex justify-center align-center flex-column">
                                    <h1>Welcome to Custom Measure</h1>
                                    <p>Follow the next steps to prepare and measure your body. This tool approximates your body measurements using Artificial intelligence</p>
                                    <!-- <p class="text-caption">Note: By using this app you agree that data submitted in this app may be used for diagnostic purposes</p> -->
                                    <v-btn
                                        color="primary"
                                        @click="currentStep = 2"
                                    >
                                    Continue
                                    </v-btn>
                                </v-card>
                            </v-stepper-content>
                            <v-stepper-content step="2">
                                <v-card min-height="400px" max-height="680px" class="d-flex justify-center align-center flex-column">
                                    <img width=80% src="img/SVG/Step2.svg">
                                    <p>Make sure the room is well lit, wear fit clothes for accurate results</p>
                                    <v-btn
                                        color="primary"
                                        @click="currentStep = 3"
                                    >
                                    Continue
                                    </v-btn>
                                </v-card>
                            </v-stepper-content>
                            <v-stepper-content step="3">
                                <v-card min-height="400px" max-height="680px" class="d-flex justify-center align-center flex-column">
                                    <img width=80%  src="img/SVG/Step3.svg">
                                    <p>Place Mobile on a chair or align webcam for full view of body.</p>
                                    <v-btn
                                        color="primary"
                                        @click="currentStep = 4"
                                    >
                                    Continue
                                    </v-btn>
                                </v-card>
                            </v-stepper-content>
                            <v-stepper-content step="4">
                                <v-card min-height="400px" max-height="680px" class="d-flex justify-center align-center flex-column">
                                    <img width=80% src="img/SVG/Step4.svg">
                                    <p>Stand still in attention position for a few seconds and then turn to your right side when the prompt comes. Our AI will measure</p>
                                    <v-btn
                                        color="primary"
                                        @click="currentStep = 5"
                                    >
                                    Continue
                                    </v-btn>
                                </v-card>
                            </v-stepper-content>
                            <v-stepper-content step="5">
                                 <camera-predict></camera-predict>
                            </v-stepper-content>
                        </v-stepper-items>
                    </v-stepper>
                <!-- </v-tab-item>
                <v-tab-item>
                    <app-upload></app-upload>
                </v-tab-item> 
            </v-tabs>-->
           
        </v-content>
        
    </v-app>

</template>

<script>
import AppUpload from './AppUpload'
import CameraPredict from './CameraPredict'

export default {
    name: "app",
    data: function() {
        return{
            currentStep: 1,
        }
    },
    components: {
        AppUpload,
        CameraPredict
    }
}
</script>

<style lang="css">
img {
    object-fit: contain;
    max-height: 500px;
}
</style>