import Vue from 'vue';
import Vuex from 'vuex';
import { getVersionAsString } from '../utils/utils.js'

Vue.use(Vuex);

export default new Vuex.Store({
    state: {
        conn: Object,
        default_conn: {
            icon: 'assets/biothings-studio-color.svg',
            name: 'BioThings Studio',
            app_version: null,
            biothings_version: null,
            url: 'http://localhost:7080'
        },
    },
    mutations: {
        saveConnection(state, payload){
            console.log('🟢 New connection >> ', payload.new_conn?.name)
            state.conn = payload.new_conn
        }
    },
    actions:{
        resetDefaultConnection ({ commit, state }) {
            console.log('🟡 Resetting connection .. ')
            commit('saveConnection', {new_conn: state.default_conn})
        }
    },
    getters:{
        conn: state => {
            return state.conn
        },
        str_app_version: state => {
            return getVersionAsString(state.conn.app_version)
        },
        str_biothings_version: state => {
            return getVersionAsString(state.conn.biothings_version)
        },
        studio_features: state => {
            if (state.conn?.features) {
                return state.conn.features.join(', ')
            } else {
                return 'not listed'
            }
        },
        icon: state =>{
            return state.conn && state.conn.icon ? state.conn.icon : false
        }
    }
});
