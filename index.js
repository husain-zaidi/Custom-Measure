
import Vue from "vue";
import "vuetify/dist/vuetify.min.css";
import Vuetify from "vuetify";
import app from './App'
import VueRouter from 'vue-router'
import routerRender from'./Router'

const routes = [
    { path: '/custom-measure', component: app },
    { path: '/', redirect: '/custom-measure' }
  ]
  
const router = new VueRouter({
    mode: 'history',
    routes // short for `routes: routes`
})
  

window.onload = (e) => {

    Vue.use(Vuetify);
    Vue.use(VueRouter);
    new Vue({
        el: '#app',
        router: router,
        vuetify: new Vuetify( {
            theme: {
            },
        }),
    })
    // const app = new Vue({
    //     router,
    //     render: h => h(routerRender)
    // }).$mount('#app');

}
