library "qpp-devops"

def jobName = JOB_NAME.replaceAll(/\/\w+%2F/,'-').toLowerCase()
def containerRegistry = "968524040713.dkr.ecr.us-east-1.amazonaws.com"
def workspace = "workspace/${jobName}"

pipeline {
  agent {
    node {
      label 'docker-agent'
      customWorkspace workspace
    }
  }

  stages {
    stage('Build & Test') {
      agent {
        dockerfile {
          label 'docker-agent'
        }
      }

      environment {
        TEST_LOG_DIR = 'logs'
        NODE_ENV = 'test'
        npm_config_cache = 'npm-cache'
        HOME = '.'
      }

      steps {
        // Build
        timeout(10) {
          sh 'node --version'
          sh 'npm --version'
          sh 'npm i'
        }

        // Test
        sh 'npm run lint'
        sh 'npm test'
      }
    }
  }

  post {
    always {
      timeout(10) {
        cleanWs()
      }
    }
  }
}
