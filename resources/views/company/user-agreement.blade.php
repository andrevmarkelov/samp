@extends('layouts.app')

@section('content')
    <div class="container py-5">
        <h1 class="fw-bold h2 color-dark-blue text-center">Пользовательское соглашение</h1>
        <p class="color-grey">
            Настоящее Соглашение призвано регулировать отношения между пользователем и правообладателем интернет-портала
            {{ config('app.url') }}, именуемый в дальнейшем «Администрация», предлагает Вам, именуемым в дальнейшем
            «Пользователи», ознакомиться с Правилами игры и проекта.
        </p>

        {{-- Общие положения --}}
        <div>
            <p class="fw-bold color-dark-blue">1. Общие положения</p>

            <ul class="color-grey">
                <li>1.1. Сайт Игры - {{ config('app.url') }}</li>
                <li>1.2. Оператор - правообладатель портала {{ config('app.url') }}, является стороной Пользовательского
                    Соглашения. Оператор осуществляет администрирование и обслуживание, предоставляет доступ
                    пользователей к порталу, услугам (также платным услугам), на условиях настоящего соглашения.
                </li>
                <li>1.3. Пользователь - физическое лицо, посещающее портал или принимающее участие в проектах
                    портала {{ config('app.url') }}</li>
                <li>1.4. Портал - размещенные на ресурсах Оператора специальные программно-аппаратные комплексы. Доступ
                    Пользователей к порталу осуществляется только Оператором. Все права на использование данного портала
                    принадлежат исключительно Оператору.
                </li>
                <li>1.5. Услуги - предоставление Пользователям доступа к Порталу, использование возможностей и сервисов,
                    участие в проектах на условиях, определенных Соглашениями. Услуги Оператора предоставляются на
                    безвозмездной основе. Исключения составляют только Дополнительные Платные Услуги. Все Услуги
                    предоставляются оператором только внутри Портала, т.е. во время его использования Пользователем.
                </li>
                <li>
                    1.6. Дополнительные Платные Услуги - предоставление Пользователю дополнительных специальных
                    возможностей Портала за плату. Данные услуги не являются обязательными и предоставляются по желанию,
                    запросу Пользователя. Платные Услуги также предоставляются Оператором исключительно внутри Портала.
                </li>
                <li>1.7. Игровой аккаунт, персонажи, предметы являются собственностью проекта и не представляют собой
                    право личной собственности. Доступ к Игровому процессу Игры возможен исключительно посредством
                    {{ $serverName }}
                </li>
            </ul>
        </div>

        {{-- Правообладатель имеет право --}}
        <div>
            <p class="fw-bold color-dark-blue">2. Правообладатель имеет право:</p>

            <ul class="color-grey">
                <li>2.1. Изменять дизайн Сайта и (или) его содержимого в любое время с уведомлением Пользователей или
                    без него.
                </li>
                <li>2.2. Удалять без каких-либо оснований и без уведомления любой контент, Материалы, комментарии, любую
                    информацию, которая по его усмотрению нарушает и / или может нарушать действующее законодательство,
                    это Соглашение, Политику конфиденциальности, права других Пользователей или третьих лиц, или наносит
                    им вред, или угрожает их безопасности.
                </li>
                <li>
                    2.3. Направлять Пользователю сообщения (в том числе посредством электронной почты, смс и т.д.),
                    которые содержат рекламную информацию о Сервисе, Игре или материалах, тематически связанных с ними.
                </li>
                <li>2.4. Полностью или частично уменьшить функциональность Сайта, Материалов по техническим,
                    превентивным или иным причинам.
                </li>
            </ul>
        </div>

        {{-- Пользователь имеет право --}}
        <div>
            <p class="fw-bold color-dark-blue">3. Пользователь имеет право:</p>

            <ul class="color-grey">
                <li>3.1. Настроить Аккаунт, изменить имя пользователя и пароль для доступа к нему.</li>
                <li>3.2. Публиковать, добавлять и редактировать свой Аккаунт и информацию в профиле Пользователя о
                    себе.
                </li>
                <li>3.3. Осуществлять иные, не запрещенные законом или настоящим Соглашением, действия, касающиеся
                    использования Сайта или Сервиса.
                </li>
            </ul>
        </div>

        {{-- Пользователь обязан --}}
        <div>
            <p class="fw-bold color-dark-blue">4. Пользователь обязан:</p>

            <ul class="color-grey">
                <li>4.1. Указать достоверную информацию на момент регистрации.</li>
                <li>4.2. Принять необходимые меры для обеспечения конфиденциальности учетных данных (логина и пароля),
                    используемых для доступа к Аккаунту.
                </li>
                <li>4.3. Соблюдать настоящее Соглашение, Политику обработки персональных данных, Правила Игры.</li>
            </ul>
        </div>

        {{-- Пользователь не вправе --}}
        <div>
            <p class="fw-bold color-dark-blue">5. Пользователь не вправе:</p>

            <ul class="color-grey">
                <li>5.1. Использовать Сайт в коммерческих целях без предварительного разрешения Правообладателя.</li>
                <li>5.2. Использовать какое-либо программное обеспечение, ошибки, дефекты в целях получения
                    несанкционированного доступа к Сервису или получения неконкурентных преимуществ, в том числе над
                    другими пользователями.
                </li>
                <li>5.3. Продавать, перепродавать, передавать Материалы, принадлежащие Правообладателю, с коммерческой
                    целью (в том числе игровую валюту, игровые ценности, Аккаунт Пользователя и т.п.).
                </li>
                <li>5.4. Распространять, публично исполнять или публично показывать любые Материалы, принадлежащие
                    Правообладателю, за исключением обычного использования Игры.
                </li>
                <li>5.5. Изменять, адаптировать, модифицировать, улучшать Игру, содержимое Игры или другие Материалы,
                    принадлежащие Правообладателю, или их части.
                </li>
                <li>5.6. Использовать программное обеспечение для сбора или удаления информации.</li>
                <li>5.7. Загружать (кроме кеша отображения страницы) любую часть Материалов, принадлежащих
                    Правообладателю, или любую содержащуюся в них информацию, за исключением случаев, явно
                    предусмотренных предполагаемой функцией Сайта.
                </li>
                <li>5.8. Копировать, переводить, публиковать, декомпилировать, выполнять технический анализ,
                    дизассемблировать или конвертировать Сайт (исходный код Сайта) или осуществлять попытку получить
                    доступ к исходному коду Сайта для создания производных работ на основе исходного кода Сайта или иным
                    образом.
                </li>
            </ul>
        </div>

        {{-- Внутриигровые покупки - "Магазин" --}}
        <div>
            <p class="fw-bold color-dark-blue">6. Внутриигровые покупки - "Магазин"</p>

            <ul class="color-grey">
                <li>6.1. Пользователь в праве совершить оплату в адрес Правообладателя добровольно, при помощи платежных
                    систем или банковских карт. За игровое пополнение средств в адрес Правообладателя Пользователь
                    получает те или иные внутриигровые ресурсы (ценности).
                </li>
                <li>6.2. Срок предоставления внутриигровых ресурсов (ценностей) составляет от 5 до 60 минут, зависит от
                    загруженности
                </li>
                <li>6.3. Правообладатель не несет ответственность за работу платежных систем.</li>
                <li>6.4. Правообладатель не несет ответственность за платежи или внутриигровое имущество Пользователя, в
                    том числе в случае блокировки Игрового Аккаунта Пользователя в связи с нарушением положений
                    настоящего Соглашения или Правил игры.
                </li>
                <li>6.5. В случае проблем с оплатой, пополнением счета или с получением игровых ценностей в игре,
                    пользователь может обратиться в техническую поддержку
                </li>
                <li>6.6. Возврат средств возможен при условии, когда пользователь, который производил оплату
                    отказывается
                    от игровых ценностей, не растратив их. В случае если игровые ценности (игровая валюта) будут
                    частично израсходованы, возврат не возможен.
                </li>
            </ul>
        </div>

        {{-- Ответственность --}}
        <div>
            <p class="fw-bold color-dark-blue">7. Ответственность</p>

            <ul class="color-grey">
                <li>7.1. Правообладатель не несет ответственность за возможные сбои и перерывы в работе Сайта и (или)
                    Сервиса и потерю информации в результате.
                </li>
                <li>7.2. Правообладатель не несет ответственность за какой-либо ущерб персональному компьютеру, мобильным
                    устройствам, любому другому оборудованию или программному обеспечению Пользователей.
                </li>
                <li>7.3. Правообладатель не несет ответственность за любые скомпрометированные пароли третьих лиц и
                    любые действия, совершенные с использованием Аккаунта Пользователя.
                </li>
                <li>7.4. Правообладатель не несет ответственность за работу сервисов и авторизацию
                    Платежных систем, осуществленных посредством указанного сервиса.
                </li>
                <li>7.5. Пользователь несет ответственность за любые незаконные действия, которые происходят в Аккаунте
                    Пользователя, а также в связи с размещением Материалов с использованием Аккаунта Пользователя на
                    Сайте.
                </li>
                <li>7.6. Пользователь несет ответственность за любую материальную или другую информацию, загружаемую
                    через Аккаунт Пользователя на Сайт и (или) Сервис.
                </li>
                <li>7.7. Пользователь обязан возместить Правообладателю или любой третьей стороне любой ущерб,
                    причиненный в результате действий Пользователя, включая, помимо прочего, нарушение настоящего
                    Соглашения, прав интеллектуальной собственности или других прав.
                </li>
            </ul>
        </div>

        {{-- Подсудность --}}
        <div>
            <p class="fw-bold color-dark-blue">9. Подсудность</p>

            <ul class="color-grey">
                <li>9.1. В случае возникновения исков/претензий/споров/запросов подсудность определяется фактической
                    регистрацией Администрации.
                </li>
            </ul>
        </div>

        {{-- Политика возврата денежных средств --}}
        <div>
            <p class="fw-bold color-dark-blue">10. Политика возврата денежных средств</p>

            <ul class="color-grey">
                <li>10.1. Возврат средств возможен при условии, когда пользователь, который производил оплату
                    отказывается от игровых ценностей, не растратив их. В случае если игровые ценности (игровая валюта)
                    будут частично израсходованы, возврат не возможен. Для возврата пользователь должен обратиться в
                    техническую поддержку игрового проекта.
                </li>
            </ul>
        </div>

    </div>
@endsection
