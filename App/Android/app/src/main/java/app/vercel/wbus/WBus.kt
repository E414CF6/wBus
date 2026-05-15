package app.vercel.wbus

import android.app.Application
import timber.log.Timber

class WBus : Application() {

    override fun onCreate() {
        super.onCreate()

        // Initialize Timber for logging
        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        }

        Timber.d("Application Started")
    }
}
