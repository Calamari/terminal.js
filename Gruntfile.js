module.exports = function(grunt) {
  // configure tasks
  grunt.initConfig({
    karma: {
      unit: {
        configFile: 'karma.conf.js',
        singleRun: true
      },
      multi: {
        configFile: 'karma.conf.js',
        singleRun: false
      }
    }
  });

  // load required tasks
  grunt.loadNpmTasks('grunt-karma');

  // register tasks for execution chain
  grunt.registerTask('test', [
    'karma'
  ]);
};
