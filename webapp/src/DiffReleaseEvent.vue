<template>
    <div class="event-container">
        <div class="ui grid">
            <div class="eight wide column">
                <div class="summary">
                    <i class="large exchange alternate icon"></i>
                    Diff with <b>{{release.old.backend || '?'}}</b> has been computed.<br>
                    Old version: <b v-if="release.old.version">{{release.old.version}}</b><i v-else>None</i>, current version: <b>{{release.new.version}}</b>
                    <div class="date">
                        Created
                        {{release.created_at | moment("from", "now")}}
                        (<i>on {{moment(release.created_at).format('MMMM Do YYYY, h:mm:ss a') }}</i>)

                    </div>
                </div>
                <div class="meta">
                    <div :class="actionable">
                        <i class="file alternate icon"></i>{{release.diff.files.length}} diff file(s) created ({{ total_diff_size | pretty_size(precision=0) }})
                        <button class="ui tinytiny grey labeled icon button" @click="applyDiff(release)">
                            <i class="external link square alternate icon"></i>Apply
                        </button>
                        <button class="ui tinytiny grey labeled icon button"
                                @click="publish(release,release_id,build._id)">
                            <i class="share alternate square icon"></i>
                            Publish
                        </button>
                    </div>
                    <i class="chart line icon"></i>{{release.diff.stats.update | formatInteger }} updated,
                    {{release.diff.stats.add | formatInteger }} added,
                    {{release.diff.stats.delete | formatInteger }} deleted.
                    <b v-if="release.diff.stats.mapping_changed">Mapping has changed.</b>
                    <div>
                    <publish-summary v-if="build.publish && build.publish.incremental && build.publish.incremental.hasOwnProperty(release_id)" :publish="build.publish.incremental[release_id]" :type="type"></publish-summary>
                    </div>
                </div>
            </div>
            <div class="eight wide column">
                <release-note-summary :build="build" :release="release"  :type="type"></release-note-summary>
            </div>
        </div>

        <!-- apply diff -->
        <div :class="['ui basic applydiff modal',release.old.backend]">
            <h3 class="ui icon">
                <i class="tag icon"></i>
                Apply increment update (diff)
            </h3>
            <div class="content">
                <div class="ui form">
                    <div class="ui centered grid">
                        <div class="eight wide column">
                            <label>Select a ElasticSeach server</label>
                            <div>
                                <select class="ui fluid es_servers dropdown" name="es_server">
                                  <option value="">------</option>
                                  <option v-if="es_servers" v-for="(server_data, es_server) in es_servers"
                                    :value="es_server"
                                  >
                                  {{ es_server}} ({{ server_data.host }})
                                  </option>
                                </select>
                                <br>
                            </div>

                            <label>Select a backend to apply the diff to</label>
                            <div>
                              <div class="ui fluid backendenv dropdown search selection">
                                <input type="hidden" name="target_backend">
                                <i class="dropdown icon"></i>
                                <div class="default text">Select backend</div>
                                <div class="menu">
                                  <div v-if="compats" v-for="compat of compats"
                                      class="item"
                                      :data-value="compat.index"
                                  >
                                      {{ compat.index }}
                                  </div>
                                </div>
                              </div>
                              <br>
                            </div>
                        </div>

                        <div class="eight wide column">
                        </div>
                    </div>
                </div>
            </div>

            <div class="ui error message" v-if="errors.length">
                <ul class="ui list">
                    <li v-for="err in errors" :key="err">{{err}}</li>
                </ul>
            </div>

            <div class="actions">
                <div class="ui red basic cancel inverted button">
                    <i class="remove icon"></i>
                    Cancel
                </div>
                <div class="ui green ok inverted button">
                    <i class="checkmark icon"></i>
                    OK
                </div>
            </div>
        </div>

        <!-- publish release-->
        <div :class="['ui basic publishrelease modal',release_id]">
            <h3 class="ui icon">
                <i class="share square icon"></i>
                Publish release
            </h3>
            <div class="content">
                <div class="ui form">
                    <div class="ui centered grid">
                        <div class="eight wide column">

                            <label>The following incremental release will be published, containing differences between:</label>
                            <table class="ui inverted darkbluey definition table">
                              <tbody>
                                <tr>
                                  <td>Current build</td>
                                  <td>{{ selected_current }}</td>
                                </tr>
                                <tr>
                                  <td>Previous build</td>
                                  <td>{{ selected_previous }}</td>
                                </tr>
                              </tbody>
                            </table>
                            <label>Note: all diff files will be uploaded
                                <span v-if="build.release_note"> as well as the release note associated to this incremental release.</span>
                                <div v-else class="ui orange small message">Release note was not found and won't be published.</div>
                            </label>
                            <br>
                            <br>

                            <div>
                                <select class="ui fluid releaseenv dropdown" name="publisher_env" v-model="selected_release_env">
                                    <option value="" disabled selected>Select a release environment</option>
                                    <option v-for="_,env in release_envs" :key="env">{{ env }}</option>
                                </select>
                            </div>

                        </div>

                        <div class="eight wide column">
                            <span v-if="selected_release_env">
                                <label>Configuration details:</label>
                                <pre class="envdetails">{{ release_envs[selected_release_env] }}</pre>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="ui error message" v-if="publish_error">
                {{publish_error}}
            </div>

            <div class="actions">
                <div class="ui red basic cancel inverted button">
                    <i class="remove icon"></i>
                    Cancel
                </div>
                <div class="ui green ok inverted button">
                    <i class="checkmark icon"></i>
                    OK
                </div>
            </div>
        </div>

    </div>
</template>

<script>
import axios from 'axios'
import bus from './bus.js'
import ReleaseNoteSummary from './ReleaseNoteSummary.vue'
import PublishSummary from './PublishSummary.vue'
import BaseReleaseEvent from './BaseReleaseEvent.vue'

export default {
  name: 'diff-release-event',
  mixins: [BaseReleaseEvent],
  props: ['release', 'build', 'type'],
  mounted () {
    const self = this

    $('.ui.es_servers.dropdown').change(self.fetchIndexes)
    $('.ui.es_servers.dropdown').dropdown()
    $('.ui.backendenv.dropdown').dropdown({
      onSearch: function (search_term) {
        self.fetchIndexes()
      },
    })

    self.fetchESServers()
  },
  beforeDestroy () {
    $(`.ui.basic.applydiff.modal.${this.release.old.backend}`).remove()
  },
  components: { ReleaseNoteSummary, PublishSummary },
  data () {
    return {
      errors: [],
      compats: {},
      es_servers: {},
      selecting_build_config: null
    }
  },
  computed: {
    release_id: function () {
      // id in that case is the build against which the diff's been computed
      // not really well named, but we can live with that, right ?
      return this.release.old.backend
    },
    total_diff_size: function () {
      var size = 0
      if (this.release.diff && this.release.diff.files) {
        this.release.diff.files.map(function (e) { size += e.size })
      }
      return size
    }
  },
  methods: {
    fetchESServers: function () {
      const self = this

      axios.get(axios.defaults.baseURL + '/config')
      .then(response => {
        const conf = response.data.result.scope.config
        const build_config_key = conf.INDEX_CONFIG.value.build_config_key
        if (build_config_key) {
          self.selecting_build_config = self.build.build_config[build_config_key]
        }
        else {
          self.selecting_build_config = null
        }

        self.es_servers = conf.INDEX_CONFIG.value.env
      })
    },
    applyDiff (release) {
      var self = this
      self.loading()

      var oldcol = release.old.backend
      var newcol = release.new.backend
      var backend_type = 'es' // TODO: should we support more ?
      var doc_type = this.build.build_config.doc_type

      $(`.ui.basic.applydiff.modal.${this.release.old.backend}`)
        .modal('setting', {
          detachable: false,
          closable: false,
          onApprove: function () {
            var backend = $('.ui.form [name=target_backend]').val()
            var host = self.compats[backend].host
            var target_backend = [host, backend, doc_type]

            self.loading()
            axios.post(axios.defaults.baseURL + '/sync',
              {
                backend_type: backend_type,
                old_db_col_names: oldcol,
                new_db_col_names: newcol,
                target_backend: target_backend
              })
              .then(response => {
                bus.$emit('reload_build_detailed')
                self.loaded()
                return response.data.result
              })
              .catch(err => {
                console.log('Error applying diff: ')
                console.log(err)
                self.loaderror(err)
              })
          }
        })
        .modal('show')
    },
    fetchIndexes () {
      const self = this
      const es_server = $('.ui.es_servers.dropdown').dropdown("get value")
      const server_data = self.es_servers[es_server]
      const search_term = $('.ui.backendenv.dropdown').dropdown("get query")
      self.compats = {}

      if (!es_server || !server_data) {
        return
      }

      const params = new URLSearchParams()
      params.set("env_name", es_server)
      if (search_term) {
        params.set("index_name", "*" + search_term + "*")
      }

      axios.get(axios.defaults.baseURL + `/indexes_by_name?${params.toString()}`)
      .then(response => {
        const indexes = response.data.result
        self.compats = self.selectCompatibles(es_server, server_data, indexes)

        self.loaded()
      })
      .catch(err => {
        console.log('Error getting index environments: ')
        console.log(err)
        self.loaderror(err)
        throw err
      })
    },
    selectCompatibles (env, env_data, indexes) {
      const self = this

      if (!env_data) {
        return {}
      }

      // check whether we can use one of build_config keys
      // to filter compatibles indices
      if (self.selecting_build_config) {
        let found = false
        for (const i in indexes) {
          const idx = indexes[i]
          if (!idx.hasOwnProperty(self.selecting_build_config)) {
            continue
          }
          found = true
        }

        if (!found) {
          return {}
        }
      }

      const _compat = {}
      indexes.forEach(index => {
        // make sure doc_type is the same
        if (index.doc_type && index.doc_type != self.build.build_config.doc_type) {
          return
        }
        _compat[index.index_name] = {
          env: env,
          host: env_data.host,
          index: index.index_name,
        }
      })

      return _compat
    },
    publish: function (release, previous_build, current_build) {
      var self = this
      self.error = null
      if (!previous_build || !current_build) {
        console.log(`Can't publish, previous_build=${previous_build}, current_build=${current_build}`)
        return
      }
      self.getReleaseEnvironments()

      self.selected_previous = previous_build
      self.selected_current = current_build
      $(`.ui.basic.publishrelease.modal.${this.release_id}`)
        .modal('setting', {
          detachable: false,
          closable: false,
          onApprove: function () {
            var params = {
              publisher_env: self.selected_release_env,
              build_name: self.selected_current,
              previous_build: self.selected_previous
            }
            if (!self.selected_release_env) { return false }
            self.loading()
            axios.post(axios.defaults.baseURL + '/publish/incremental', params)
              .then(response => {
                bus.$emit('reload_build_detailed')
                self.loaded()
                return response.data.result
              })
              .catch(err => {
                console.log('Error publishing release: ')
                console.log(err)
                self.loaderror(err)
              })
          }
        })
        .modal('show')
    }
  }
}
</script>

<style scoped>
.tinytiny {
    padding: .5em 1em .5em;
    font-size: .6em;
}
.event-container {
    margin-bottom: 1em;
    width: inherit;
}
.envdetails {
    font-size: .8em;
    overflow: visible !important;
}
</style>
