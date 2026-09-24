pipeline {

    agent any

    parameters {

        choice(
            name: 'ACTION',
            choices: ['DEPLOY', 'ROLLBACK'],
            description: 'Deployment action'
        )

        choice(
            name: 'VERSION',
            choices: ['7.9.0', '7.8.0'],
            description: 'Application version'
        )

        choice(
            name: 'CONFIRM_PRODUCTION',
            choices: ['NO', 'YES'],
            description: 'Production deployment confirmation'
        )
    }

    environment {

        IMAGE_NAME = 'orders-api'

        BLUE_CONTAINER = 'orders-blue'
        GREEN_CONTAINER = 'orders-green'

        BLUE_PORT = '8091'
        GREEN_PORT = '8092'

        PROXY_CONTAINER = 'orders-proxy'
        PROXY_PORT = '8090'

        DB_CONTAINER = 'orders-db'
        NETWORK_NAME = 'orders-network'

        DB_HOST = 'orders-db'
        DB_PORT = '3306'
        DB_USER = 'ordersuser'
        DB_PASSWORD = 'orderspass'
        DB_NAME = 'ordersdb'
    }

    stages {

        stage('Checkout') {
            steps {

                echo '===== CHECKOUT ====='

                bat 'git checkout main'
                bat 'git pull origin main'

                script {
                    env.GIT_COMMIT_SHA = bat(
                        script: '@git rev-parse HEAD',
                        returnStdout: true
                    ).trim()
                }

                echo "Git Commit: ${env.GIT_COMMIT_SHA}"
            }
        }

        stage('Validate Version') {
            steps {

                echo '===== VERSION VALIDATION ====='

                script {

                    if (!(params.VERSION ==~ /^\d+\.\d+\.\d+$/)) {
                        error("Invalid version: ${params.VERSION}")
                    }

                    if (params.CONFIRM_PRODUCTION != 'YES') {
                        error(
                            'Production deployment requires CONFIRM_PRODUCTION=YES'
                        )
                    }
                }

                echo "Version ${params.VERSION} validated"
            }
        }

        stage('Unit/Application Test') {
            steps {

                echo '===== APPLICATION TESTS ====='

                bat '''
                    echo ===== INSTALLING APPLICATION DEPENDENCIES =====
                    cd app
                    call npm ci --include=dev

                    echo ===== CHECKING SUPERTEST =====
                    call npm list supertest

                    echo ===== RETURNING TO PROJECT ROOT =====
                    cd ..

                    echo ===== RUNNING JEST =====
                    call app\\node_modules\\.bin\\jest --runInBand --config=jest.config.js
                '''
            }
        }

        stage('Docker Build') {
            steps {

                echo "===== BUILDING ${IMAGE_NAME}:${params.VERSION} ====="

                bat "docker build --no-cache -t ${IMAGE_NAME}:${params.VERSION} ."
            }
        }

        stage('Docker Image Validation') {
            steps {

                echo '===== IMAGE VALIDATION ====='

                bat "docker image inspect ${IMAGE_NAME}:${params.VERSION}"
            }
        }

        stage('Start Candidate') {
            steps {

                script {

                    def candidateContainer
                    def candidatePort

                    if (params.VERSION == '7.9.0') {

                        candidateContainer = GREEN_CONTAINER
                        candidatePort = GREEN_PORT

                    } else {

                        candidateContainer = BLUE_CONTAINER
                        candidatePort = BLUE_PORT
                    }

                    env.CANDIDATE_CONTAINER = candidateContainer
                    env.CANDIDATE_PORT = candidatePort

                    echo "Candidate: ${candidateContainer}"
                    echo "Candidate Port: ${candidatePort}"

                    echo "===== REMOVING EXISTING CANDIDATE ====="

                    bat "docker rm -f ${candidateContainer} 2>nul || exit /b 0"

                    echo "===== STARTING CANDIDATE CONTAINER ====="

                    bat """
                    docker run -d ^
                    --name ${candidateContainer} ^
                    -p ${candidatePort}:3000 ^
                    --network ${NETWORK_NAME} ^
                    -e PORT=3000 ^
                    -e APP_VERSION=${params.VERSION} ^
                    -e ENVIRONMENT=PRODUCTION ^
                    -e GIT_COMMIT=${env.GIT_COMMIT_SHA} ^
                    -e DB_HOST=${DB_HOST} ^
                    -e DB_PORT=${DB_PORT} ^
                    -e DB_USER=${DB_USER} ^
                    -e DB_PASSWORD=${DB_PASSWORD} ^
                    -e DB_NAME=${DB_NAME} ^
                    ${IMAGE_NAME}:${params.VERSION}
                    """
                }
            }
        }

        stage('Container Validation') {
            steps {

                echo '===== CONTAINER VALIDATION ====='

                bat "docker ps --filter name=${env.CANDIDATE_CONTAINER}"

                bat """
                docker inspect ${env.CANDIDATE_CONTAINER} ^
                --format "{{.State.Status}} {{.State.ExitCode}}"
                """

                bat """
                docker inspect ${env.CANDIDATE_CONTAINER} ^
                --format "{{.State.Health.Status}}"
                """
            }
        }

        stage('Application Health Check') {
            steps {

                echo '===== APPLICATION HEALTH CHECK ====='

                bat """
                curl --fail ^
                http://127.0.0.1:${env.CANDIDATE_PORT}/health
                """
            }
        }

        stage('Integration Check') {
            steps {

                echo '===== INTEGRATION CHECK ====='

                bat """
                curl --fail ^
                http://127.0.0.1:${env.CANDIDATE_PORT}/version
                """

                bat """
                curl --fail ^
                http://127.0.0.1:${env.CANDIDATE_PORT}/orders
                """
            }
        }

        stage('Traffic Switch') {
            steps {

                script {

                    echo "===== SWITCHING TRAFFIC TO ${env.CANDIDATE_CONTAINER} ====="

                    if (env.CANDIDATE_CONTAINER == GREEN_CONTAINER) {

                        echo '===== CONFIGURING NGINX FOR GREEN ====='

                        bat '''
                        (
                            echo events {}
                            echo.
                            echo http {
                            echo     upstream orders_backend {
                            echo         server orders-green:3000;
                            echo     }
                            echo.
                            echo     server {
                            echo         listen 80;
                            echo.
                            echo         location / {
                            echo             proxy_pass http://orders_backend;
                            echo             proxy_set_header Host $host;
                            echo             proxy_set_header X-Real-IP $remote_addr;
                            echo             proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                            echo         }
                            echo     }
                            echo }
                        ) > proxy\\nginx.conf
                        '''

                    } else {

                        echo '===== CONFIGURING NGINX FOR BLUE ====='

                        bat '''
                        (
                            echo events {}
                            echo.
                            echo http {
                            echo     upstream orders_backend {
                            echo         server orders-blue:3000;
                            echo     }
                            echo.
                            echo     server {
                            echo         listen 80;
                            echo.
                            echo         location / {
                            echo             proxy_pass http://orders_backend;
                            echo             proxy_set_header Host $host;
                            echo             proxy_set_header X-Real-IP $remote_addr;
                            echo             proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                            echo         }
                            echo     }
                            echo }
                        ) > proxy\\nginx.conf
                        '''
                    }

                    echo '===== VALIDATING NGINX CONFIGURATION ====='

                    bat '''
                    docker run --rm ^
                    --network orders-network ^
                    -v "%cd%\\proxy\\nginx.conf:/etc/nginx/nginx.conf:ro" ^
                    nginx:alpine nginx -t
                    '''

                    echo '===== REMOVING OLD NGINX PROXY ====='

                    bat "docker rm -f ${PROXY_CONTAINER} 2>nul || exit /b 0"

                    echo '===== STARTING NGINX PROXY ====='

                    bat """
                    docker run -d ^
                    --name ${PROXY_CONTAINER} ^
                    -p ${PROXY_PORT}:80 ^
                    --network ${NETWORK_NAME} ^
                    -v "%cd%\\proxy\\nginx.conf:/etc/nginx/nginx.conf:ro" ^
                    nginx:alpine
                    """

                    echo '===== WAITING FOR PROXY HEALTH ====='

                    timeout(time: 30, unit: 'SECONDS') {

                        waitUntil {

                            def result = bat(
                                script: "curl --fail http://127.0.0.1:${PROXY_PORT}/health",
                                returnStatus: true
                            )

                            return result == 0
                        }
                    }
                }
            }
        }

        stage('Deployment Verification') {
            steps {

                echo '===== DEPLOYMENT VERIFICATION ====='

                bat "curl --fail http://127.0.0.1:${PROXY_PORT}/"

                bat "curl --fail http://127.0.0.1:${PROXY_PORT}/health"

                bat "curl --fail http://127.0.0.1:${PROXY_PORT}/version"

                echo "Production Version: ${params.VERSION}"
                echo "Git Commit: ${env.GIT_COMMIT_SHA}"
            }
        }

        stage('Old Version Cleanup') {
            steps {

                script {

                    def oldContainer

                    if (env.CANDIDATE_CONTAINER == GREEN_CONTAINER) {

                        oldContainer = BLUE_CONTAINER

                    } else {

                        oldContainer = GREEN_CONTAINER
                    }

                    echo "===== REMOVING OLD CONTAINER: ${oldContainer} ====="

                    bat "docker rm -f ${oldContainer} 2>nul || exit /b 0"
                }
            }
        }
    }

    post {

        success {

            echo '======================================'
            echo 'DEPLOYMENT SUCCESSFUL'
            echo "Version: ${params.VERSION}"
            echo "Git Commit: ${env.GIT_COMMIT_SHA}"
            echo '======================================'
        }

        failure {

            echo '======================================'
            echo 'DEPLOYMENT FAILED'
            echo 'Removing failed candidate'
            echo 'Existing production remains protected'
            echo '======================================'

            script {

                if (env.CANDIDATE_CONTAINER) {

                    bat "docker rm -f ${env.CANDIDATE_CONTAINER} 2>nul || exit /b 0"
                }
            }
        }

        always {

            echo '===== FINAL DOCKER STATUS ====='

            bat 'docker ps -a'
        }
    }
}