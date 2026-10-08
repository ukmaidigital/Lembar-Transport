<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Forget resolved guards after each request so that switching bearer tokens
     * within one test authenticates the right user (the Sanctum guard caches the user).
     */
    public function call($method, $uri, $parameters = [], $cookies = [], $files = [], $server = [], $content = null)
    {
        $response = parent::call($method, $uri, $parameters, $cookies, $files, $server, $content);
        $this->app['auth']->forgetGuards();

        return $response;
    }
}
