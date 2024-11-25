@extends('layouts.profile')

@section('profile-content')
    <div>
        <h1 class="h3 text-center mb-3">История платежей</h1>

        <div class="table-responsive">
            <table class="table table-striped table-hover table-sm">
                <thead>
                <tr>
                    <th scope="col">#</th>
                    <th scope="col">Сумма</th>
                    <th scope="col">Статус</th>
                    <th scope="col">Дата</th>
                </tr>
                </thead>
                <tbody>
                @forelse($payments as $payment)
                    <tr>
                        <th scope="row">{{ $payment->id }}</th>
                        <td>{{ number_format($payment->amount, 2) }}</td>
                        <td>{{ $payment->status->description() }}</td>
                        <td>{{ $payment->created_at->format('d.m.Y') }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="4" class="text-center">Ваша история платежей пока пуста.</td>
                    </tr>
                @endforelse
                </tbody>
            </table>
        </div>

        {{ $payments->links('inc.pagination') }}
    </div>
@endsection
