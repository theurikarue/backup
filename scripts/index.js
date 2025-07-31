 
        // API Configuration
        const API_CONFIG = {
            LOGIN_URL: ' https://api.example.com/login',
            VERIFY_OTP_URL: 'https://api.example.com/verify-otp',
            DASHBOARD_URL: 'dashboard.html'
        };

        // State management
        let currentStep = 1;
        let userEmail = '';

        // DOM elements
        const form = document.getElementById('loginForm');
        const step1Form = document.getElementById('step1Form');
        const step2Form = document.getElementById('step2Form');
        const step1Indicator = document.getElementById('step1');
        const step2Indicator = document.getElementById('step2');
        const line1 = document.getElementById('line1');
        
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const otpInput = document.getElementById('otp');
        
        const loginBtn = document.getElementById('loginBtn');
        const verifyBtn = document.getElementById('verifyBtn');
        const backBtn = document.getElementById('backBtn');
        
        const loading1 = document.getElementById('loading1');
        const loading2 = document.getElementById('loading2');
        const errorMessage = document.getElementById('errorMessage');
        const successMessage = document.getElementById('successMessage');

        // Utility functions
        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
            successMessage.style.display = 'none';
        }

        function showSuccess(message) {
            successMessage.textContent = message;
            successMessage.style.display = 'block';
            errorMessage.style.display = 'none';
        }

        function hideMessages() {
            errorMessage.style.display = 'none';
            successMessage.style.display = 'none';
            emailInput.classList.remove('error');
            passwordInput.classList.remove('error');
            otpInput.classList.remove('error');
        }

        function setLoadingState(button, loading, isLoading) {
            if (isLoading) {
                button.style.position = 'relative';
                button.querySelector('span').style.opacity = '0';
                loading.style.display = 'block';
                button.disabled = true;
            } else {
                button.querySelector('span').style.opacity = '1';
                loading.style.display = 'none';
                button.disabled = false;
            }
        }

        function goToStep(step) {
            currentStep = step;
            
            if (step === 1) {
                step1Form.classList.add('active');
                step2Form.classList.remove('active');
                step1Indicator.classList.add('active');
                step2Indicator.classList.remove('active');
                step1Indicator.classList.remove('completed');
                line1.classList.remove('active');
            } else {
                step1Form.classList.remove('active');
                step2Form.classList.add('active');
                step1Indicator.classList.remove('active');
                step1Indicator.classList.add('completed');
                step2Indicator.classList.add('active');
                line1.classList.add('active');
            }
            
            hideMessages();
        }

        // API functions
        async function makeApiCall(url, data) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                const responseData = await response.json();

                if (!response.ok) {
                    throw new Error(responseData.message || responseData.error || 'Request failed');
                }

                return responseData;
            } catch (error) {
                console.error('API call failed:', error);
                throw error;
            }
        }

        function storeAuthData(data) {
            // Store authentication tokens and user data
            if (data.access_token || data.token) {
                const token = data.access_token || data.token;
                sessionStorage.setItem('access_token', token);
            }
            if (data.refresh_token) {
                sessionStorage.setItem('refresh_token', data.refresh_token);
            }
            if (data.user) {
                sessionStorage.setItem('user_data', JSON.stringify(data.user));
            }
        }

        // Event listeners
        // Login
        loginBtn.addEventListener('click', async function() {
            hideMessages();
            
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            
            if (!email) {
                showError('Please enter your email address');
                emailInput.classList.add('error');
                return;
            }
            
            if (!password) {
                showError('Please enter your password');
                passwordInput.classList.add('error');
                return;
            }

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showError('Please enter a valid email address');
                emailInput.classList.add('error');
                return;
            }

            setLoadingState(loginBtn, loading1, true);
            
            try {
                const loginData = {
                    phone: email, // API expects 'phone' field for email
                    password: password
                };

                const response = await makeApiCall(API_CONFIG.LOGIN_URL, loginData);
                
                userEmail = email;
                showSuccess('Login successful! Please check your email for the OTP code.');
                
                setTimeout(() => {
                    goToStep(2);
                    otpInput.focus();
                }, 1500);
                
            } catch (error) {
                console.error('Login failed:', error);
                showError(error.message || 'Login failed. Please check your credentials.');
                emailInput.classList.add('error');
                passwordInput.classList.add('error');
            } finally {
                setLoadingState(loginBtn, loading1, false);
            }
        });

        // Verify OTP
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (currentStep !== 2) return;
            
            hideMessages();
            
            const otp = otpInput.value.trim();
            if (!otp) {
                showError('Please enter the OTP code');
                otpInput.classList.add('error');
                return;
            }
            
            if (otp.length !== 5) {
                showError('OTP must be 5 digits');
                otpInput.classList.add('error');
                return;
            }
            
            setLoadingState(verifyBtn, loading2, true);
            
            try {
                const verifyData = {
                    email: userEmail,
                    otp: parseInt(otp) // API expects OTP as number
                };

                const response = await makeApiCall(API_CONFIG.VERIFY_OTP_URL, verifyData);
                
                storeAuthData(response);
                
                showSuccess('Verification successful! Redirecting to dashboard...');
                
                setTimeout(() => {
                    window.location.href = API_CONFIG.DASHBOARD_URL;
                }, 1500);
                
            } catch (error) {
                console.error('Verify OTP failed:', error);
                showError(error.message || 'Invalid OTP code. Please try again.');
                otpInput.classList.add('error');
            } finally {
                setLoadingState(verifyBtn, loading2, false);
            }
        });

        // Back button
        backBtn.addEventListener('click', function() {
            goToStep(1);
        });

        // Auto-format OTP input
        otpInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 5) value = value.slice(0, 5);
            e.target.value = value;
        });

        // Enter key handling
        emailInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                passwordInput.focus();
            }
        });

        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                loginBtn.click();
            }
        });

        otpInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                verifyBtn.click();
            }
        });

        // Check if user is already logged in
        window.addEventListener('load', function() {
            const accessToken = sessionStorage.getItem('access_token');
            if (accessToken) {
                window.location.href = API_CONFIG.DASHBOARD_URL;
            }
        });
