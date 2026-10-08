<?php

return [
    'auth.otp' => ['title' => 'OTP code', 'body' => 'Your Lembar Transport OTP code: :code. Valid for :minutes minutes. Never share it.'],
    'order.pending_payment' => ['title' => 'Complete your payment', 'body' => 'Booking :code (Lembar → :destination, :pickup) is awaiting payment of :total. Instructions: :ticket_url'],
    'order.confirmed' => ['title' => 'Booking confirmed', 'body' => 'Booking :code is confirmed: Lembar → :destination, :pickup. Meeting point: :meeting_point. Ticket: :ticket_url'],
    'payment.rejected' => ['title' => 'Payment proof rejected', 'body' => 'The proof for booking :code was rejected: :reason. Upload again at :ticket_url'],
    'payment.expired' => ['title' => 'Booking expired', 'body' => 'Payment for booking :code was not received in time. Book again: :ticket_url'],
    'order.driver_assigned' => ['title' => 'Driver assigned', 'body' => 'Your driver for :code: :driver, :vehicle (:plate). Meeting point: :meeting_point. Details: :ticket_url'],
    'order.driver_changed' => ['title' => 'Driver changed', 'body' => 'The driver for :code is now :driver, :vehicle (:plate). Details: :ticket_url'],
    'order.driver_arrived' => ['title' => 'Your driver is waiting', 'body' => 'Driver :driver (:plate) is waiting at :meeting_point holding a name board for :name.'],
    'order.completed' => ['title' => 'Trip completed', 'body' => 'Thank you! Booking :code is complete. Rate your driver: :ticket_url/ulasan'],
    'order.cancelled' => ['title' => 'Booking cancelled', 'body' => 'Booking :code has been cancelled. Details: :ticket_url'],
    'order.reminder_day_before' => ['title' => 'Trip reminder for tomorrow', 'body' => 'Tomorrow :pickup: Lembar → :destination. Driver :driver (:plate), meeting point :meeting_point. Tap "Ferry has docked" on arrival: :ticket_url'],
    'order.reminder_pre_arrival' => ['title' => 'Ferry docking soon', 'body' => 'Estimated docking ± :pickup. Driver :driver (:plate) is heading to :meeting_point.'],
];
