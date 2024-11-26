// Авторизация пользователя в Личный кабинет
document.getElementById('loginModal').addEventListener('submit', async (event) => {
    event.preventDefault();

    const form = new FormData(event.target);
    const username = form.get('username');
    const password = form.get('password');
    const remember = form.get('remember');

    try {
        const response = await axios.post('/auth/login', { username, password, remember }, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
            }
        });

        if (response.status === 200) {
            return window.location.href = '/profile';
        }

    } catch (error) {
        if (error.response && error.response.status === 401) {
            const errorText = document.createElement('div');
            errorText.className = 'alert alert-danger';
            errorText.textContent = error.response.data.response;
            event.target.parentNode.prepend(errorText);

        } else if (error.response && error.response.status === 422) {
            const errors = error.response.data.errors;

            for (const field in errors) {
                const fieldElement = document.getElementById(field);

                if (fieldElement) {
                    fieldElement.classList.add('is-invalid');
                    const errorText = document.createElement('div');
                    errorText.className = 'text-danger';
                    errorText.textContent = errors[field][0];
                    fieldElement.parentNode.appendChild(errorText);
                }
            }
        } else {
            console.error('Ошибка сервера:', error);
        }
    }
});

// Восстановление пароля
document.getElementById('forgotPasswordModal').addEventListener('submit', async (event) => {
    event.preventDefault();

    const form = new FormData(event.target);
    const email = form.get('email');

    try {
        const response = await axios.post('/auth/forgot-password', {email}, {
           headers: {
               'X-Requested-With': 'XMLHttpRequest',
               'Content-Type': 'application/json',
               'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
           }
        });

        if (response.status === 200) {
            const successText = document.createElement('div');
            successText.className = 'alert alert-success';
            successText.textContent = response.data.response;
            event.target.parentNode.prepend(successText);
        }

    } catch (error) {
        if (error.response && error.response.status === 400) {
            const errorText = document.createElement('div');
            errorText.className = 'alert alert-danger';
            errorText.textContent = error.response.data.response[0];
            event.target.parentNode.prepend(errorText);
        } else {
            console.error('Ошибка сервера:', error);
        }
    }
});
