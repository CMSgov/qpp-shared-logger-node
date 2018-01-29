pipeline {
  agent any
  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Build') {
      steps {
        sh 'yarn'
      }
    }

    stage('Test') {
      environment {
        TEST_LOG_DIR = 'logs'
      }
      steps {
        sh 'yarn nsp'
        sh 'yarn lint'
        sh 'yarn test'
      }
    }

    stage('Cleanup') {
      steps {
        deleteDir()
      }
    }

  }
}
