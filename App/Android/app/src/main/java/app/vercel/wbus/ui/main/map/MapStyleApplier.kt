package app.vercel.wbus.ui.main.map

import android.content.Context
import android.content.res.Configuration
import app.vercel.wbus.R
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.model.MapStyleOptions
import timber.log.Timber

object MapStyleApplier {
    fun apply(context: Context, map: GoogleMap) {
        val isDarkMode =
            (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

        if (!isDarkMode) {
            map.setMapStyle(null)
            return
        }

        try {
            val success = map.setMapStyle(MapStyleOptions.loadRawResourceStyle(context, R.raw.map_style))
            if (!success) Timber.e("Style parsing failed.")
        } catch (e: Exception) {
            Timber.e(e, "Can't find style")
        }
    }
}
