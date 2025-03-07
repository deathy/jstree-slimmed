/*global module:false, require:false, __dirname:false*/
var _ = require('lodash');

module.exports = function(grunt) {
  grunt.util.linefeed = "\n";

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      options : {
        separator : "\n"
      },
      dist: {
        src: ['src/jstree.js', 'src/jstree.*.js', 'src/vakata-jstree.js'],
        dest: 'dist/jstree-slimmed.js'
      }
    },
    copy: {
      libs : {
        files : [
          { expand: true, cwd : 'libs/', src: ['*'], dest: 'dist/libs/' }
        ]
      },
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - <%= grunt.template.today("yyyy-mm-dd") %> - (<%= _.map(pkg.licenses, "type").join(", ") %>) */\n',
        preserveComments: false,
        //sourceMap: "dist/jstree.min.map",
        //sourceMappingURL: "jstree.min.map",
        report: "min",
        output: {
                ascii_only: true
        },
        compress: {
                hoist_funs: false,
                loops: false,
                unused: false
        }
      },
      dist: {
        src: ['<%= concat.dist.dest %>'],
        dest: 'dist/jstree-slimmed.min.js'
      }
    },
    jshint: {
      options: {
        'curly' : true,
        'eqeqeq' : true,
        'latedef' : true,
        'newcap' : true,
        'noarg' : true,
        'sub' : true,
        'undef' : true,
        'boss' : true,
        'eqnull' : true,
        'browser' : true,
        'trailing' : true,
        'globals' : {
          'console' : true,
          'jQuery' : true,
          'browser' : true,
          'XSLTProcessor' : true,
          'ActiveXObject' : true
        }
      },
      beforeconcat: ['src/jstree.js', 'src/jstree.*.js'],
      afterconcat: ['dist/jstree-slimmed.js']
    },
    amd : {
      files: {
        src: ['dist/jstree-slimmed.js'],
        dest: 'dist/jstree-slimmed.js'
      }
    },
    less: {
      production: {
        options : {
          cleancss : true,
          compress : true,
          math : 'always'
        },
        files: {
          "dist/themes/default/style.min.css" : "src/themes/default/style.less",
          "dist/themes/default-dark/style.min.css" : "src/themes/default-dark/style.less"
        }
      },
      development: {
        options : {
          math : 'always'
        },
        files: {
          "src/themes/default/style.css" : "src/themes/default/style.less",
          "dist/themes/default/style.css" : "src/themes/default/style.less",
          "src/themes/default-dark/style.css" : "src/themes/default-dark/style.less",
          "dist/themes/default-dark/style.css" : "src/themes/default-dark/style.less"
        }
      }
    },
    watch: {
      js : {
        files: ['src/**/*.js'],
        tasks: ['js'],
        options : {
          atBegin : true
        }
      },
      css : {
        files: ['src/**/*.less','src/**/*.png','src/**/*.gif'],
        tasks: ['css'],
        options : {
          atBegin : true
        }
      },
    },
    imagemin: {
      dynamic: {
        options: {                       // Target options
          optimizationLevel: 7,
          pngquant : true
        },
        files: [{
          expand: true,                  // Enable dynamic expansion
          cwd:  'src/themes/default/',    // Src matches are relative to this path
          src: ['**/*.{png,jpg,gif}'],   // Actual patterns to match
          dest: 'dist/themes/default/'   // Destination path prefix
        },{
          expand: true,                  // Enable dynamic expansion
          cwd:  'src/themes/default-dark/',    // Src matches are relative to this path
          src: ['**/*.{png,jpg,gif}'],   // Actual patterns to match
          dest: 'dist/themes/default-dark/'   // Destination path prefix
        }]
      }
    },
    replace: {
      files: {
        src: ['dist/*.js'],
        overwrite: true,
        replacements: [
          {
            from: '{{VERSION}}',
            to: "<%= pkg.version %>"
          },
          {
            from: /"version": "[^"]+"/g,
            to: "\"version\": \"<%= pkg.version %>\""
          },
        ]
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-imagemin');
  grunt.loadNpmTasks('grunt-text-replace');

  grunt.registerMultiTask('amd', 'Clean up AMD', function () {
    var s, d;
    this.files.forEach(function (f) {
      s = f.src[0];
      d = f.dest;
    });
    grunt.file.copy(s, d, {
      process: function (contents) {
        contents = contents.replace(/\s*if\(\$\.jstree\.plugins\.[a-z]+\)\s*\{\s*return;\s*\}/ig, '');
        contents = contents.replace(/\/\*globals[^\/]+\//ig, '');
        //contents = contents.replace(/\(function \(factory[\s\S]*?undefined/mig, '(function ($, undefined');
        //contents = contents.replace(/\}\)\);/g, '}(jQuery));');
        contents = contents.replace(/\(function \(factory[\s\S]*?undefined\s*\)[^\n]+/mig, '');
        contents = contents.replace(/\}\)\);/g, '');
        contents = contents.replace(/\s*("|')use strict("|');/g, '');
        contents = contents.replace(/\s*return \$\.fn\.jstree;/g, '');
        return grunt.file.read('src/intro.js') + contents + grunt.file.read('src/outro.js');
      }
    });
  });

  grunt.util.linefeed = "\n";

  // Default task.
  grunt.registerTask('default', ['jshint:beforeconcat','concat','amd','jshint:afterconcat','copy:libs','uglify','less','imagemin','replace']);
  grunt.registerTask('js', ['concat','amd','uglify']);
  grunt.registerTask('css', ['copy','less']);

};
