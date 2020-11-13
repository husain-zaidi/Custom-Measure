
import Vue from "vue";
import "vuetify/dist/vuetify.min.css";
import Vuetify from "vuetify";
import app from './App'
import VueRouter from 'vue-router'
import routerRender from'./Router'

const routes = [
    { path: '/custom-measure', component: app },
    { path: '/', component: app }
  ]
  
const router = new VueRouter({
    routes // short for `routes: routes`
})
  

window.onload = (e) => {

    Vue.use(Vuetify);
    Vue.use(VueRouter);
    new Vue({
        el: '#app',
        router: router,
        render: h => h(app),
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
