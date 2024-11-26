@extends('layouts.profile')

@section('profile-content')
    <div>
        <h1 class="h3 text-center mb-3">Смена пароля</h1>
        <form id="changePasswordForm" action="{{ route('profile.settings.password') }}" method="POST">
            @csrf
            <div class="mb-3">
                <label for="current_password" class="form-label">Текущий пароль</label>
                <input type="password" class="form-control" id="current_password" name="current_password" placeholder="Введите текущий пароль" required>
            </div>
            <div class="mb-3">
                <label for="new_password" class="form-label">Новый пароль</label>
                <input type="password" class="form-control" id="new_password" name="new_password" placeholder="Введите новый пароль" minlength="6" required>
            </div>
            <div class="mb-3">
                <label for="new_password_confirmation" class="form-label">Подтвердите новый пароль</label>
                <input type="password" class="form-control" id="new_password_confirmation" name="new_password_confirmation" placeholder="Повторите новый пароль" minlength="6" required>
            </div>
            <button type="submit" class="btn-default">Сменить пароль</button>
        </form>

    </div>
@endsection

@push('scripts')
    <script>
        document.getElementById('changePasswordForm').addEventListener('submit', async (event) => {
            event.preventDefault();

            const form = new FormData(event.target);
            const current_password = form.get('current_password');
            const new_password = form.get('new_password');
            const new_password_confirmation  = form.get('new_password_confirmation');

            try {
                const response = await axios.post('/profile/settings', { current_password, new_password, new_password_confirmation }, {
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
                if (error.response && error.response.status === 422) {
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
    </script>
@endpush
