<div>
    <img src="{{ asset('assets/images/skins/' . $p_skin . '.png') }}" alt="1" width="131" height="131" class="rounded-circle">
    {{ $username }}

</div>

<ul>
    <li><a href="{{ route('profile.index') }}">Личный кабинет</a></li>
    <li><a href="{{ route('profile.settings') }}">Настройки</a></li>
    <li>
        <form action="{{ route('profile.logout') }}" method="POST">
            @csrf
            <button type="submit">Выход</button>
        </form>
    </li>
</ul>
