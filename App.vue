<template>
     <v-app>
        <v-app-bar app>
            <v-toolbar-title class="display-1 font-black"> Custom Measure </v-toolbar-title>

        </v-app-bar>
        <v-content>
            <v-container>
            <v-tabs>
                <v-tab>App</v-tab>
                <v-tab>Upload Data</v-tab>
                <v-tab-item>
                    <camera-predict></camera-predict>
                </v-tab-item>
                <v-tab-item>
                    <app-upload></app-upload>
                </v-tab-item>
            </v-tabs>
            </v-container>
           
        </v-content>
        
    </v-app>

</template>

<script>
import AppUpload from './AppUpload'
import CameraPredict from './CameraPredict'

export default {
    name: "app",
    
    components: {
        AppUpload,
        CameraPredict
    }
}
</script>
