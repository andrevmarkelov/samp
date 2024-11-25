<div class="d-flex flex-column flex-shrink-0 p-3 bg-body-tertiary min-vh-100" style="width: 280px;">
    <a href="{{ route('home') }}" class="d-flex align-items-center justify-content-center mb-3 mb-md-0 me-md-auto">
        <img src="{{ asset('assets/images/logo.png') }}" alt="{{ $serverName }}" width="100">
    </a>
    <hr>
    <ul class="nav nav-pills flex-column mb-auto">
        <li class="nav-item">
            <a href="{{ route('admin.index') }}" class="nav-link link-body-emphasis">
                <i class="bi bi-house-door"></i>
                Главная
            </a>
        </li>
        <li>
            <a href="{{ route('admin.news') }}" class="nav-link link-body-emphasis">
                <i class="bi bi-newspaper"></i>
                Новости
            </a>
        </li>
        <li>
            <a href="{{ route('admin.users') }}" class="nav-link link-body-emphasis">
                <i class="bi bi-people"></i>
                Пользователи
            </a>
        </li>
    </ul>
    <hr>
    <div class="dropdown">
        <button class="d-flex align-items-center link-body-emphasis dropdown-toggle border-0 bg-body-tertiary" data-bs-toggle="dropdown" aria-expanded="false">
            <img src="{{ asset('assets/images/skins/295.png') }}" alt="" width="32" height="32" class="rounded-circle me-2">
            <strong>{{ $admin->name }}</strong>
        </button>
        <ul class="dropdown-menu text-small shadow" style="">
            <li><a class="dropdown-item" href="#">Профиль</a></li>
            <li><a class="dropdown-item" href="#">Настройки</a></li>
            <li><hr class="dropdown-divider"></li>
            <li>
                <form action="{{ route('admin.logout') }}" method="POST">
                    @csrf
                    <button type="submit" class="dropdown-item">Выход</button>
                </form>
            </li>
        </ul>
    </div>
</div>
