
import Vue from "vue";
import "vuetify/dist/vuetify.min.css";
import Vuetify from "vuetify";
import app from './App'


window.onload = (e) => {

    Vue.use(Vuetify);
    new Vue({
        el: '#app',
        render: h => h(app),
        vuetify: new Vuetify(),
    })


}
