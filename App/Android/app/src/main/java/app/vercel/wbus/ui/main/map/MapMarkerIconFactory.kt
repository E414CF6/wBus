package app.vercel.wbus.ui.main.map

import android.content.Context
import android.graphics.*
import androidx.core.content.ContextCompat
import androidx.core.graphics.createBitmap
import androidx.core.graphics.toColorInt
import app.vercel.wbus.R
import com.google.android.gms.maps.model.BitmapDescriptor
import com.google.android.gms.maps.model.BitmapDescriptorFactory

class MapMarkerIconFactory(private val context: Context) {
    private var stopMarkerIcon: BitmapDescriptor? = null
    private val busMarkerIconCache = mutableMapOf<String, BitmapDescriptor>()

    fun getStopMarkerIcon(): BitmapDescriptor? {
        if (stopMarkerIcon == null) {
            stopMarkerIcon = createVectorDescriptor(R.drawable.ic_bus_stop, 42, 42)
        }
        return stopMarkerIcon
    }

    fun getBusMarkerIcon(routeText: String): BitmapDescriptor {
        return busMarkerIconCache.getOrPut(routeText) {
            val width = dpToPx(44f)
            val height = dpToPx(56f)
            val bitmap = createBitmap(width, height)
            val canvas = Canvas(bitmap)

            val markerColor = "#5C4EE5".toColorInt()

            val shadowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.argb(60, 0, 0, 0)
                setShadowLayer(dpToPx(3f).toFloat(), 0f, dpToPx(2f).toFloat(), Color.argb(60, 0, 0, 0))
            }

            val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = markerColor
                style = Paint.Style.FILL
            }

            val tailSize = dpToPx(24f).toFloat()
            val tailLeft = (width - tailSize) / 2f
            val tailTop = dpToPx(26f).toFloat()
            val tailRect = RectF(tailLeft, tailTop, tailLeft + tailSize, tailTop + tailSize)
            val tailRadius = dpToPx(10f).toFloat()

            canvas.drawRoundRect(tailRect, tailRadius, tailRadius, shadowPaint)
            canvas.drawRoundRect(tailRect, tailRadius, tailRadius, fillPaint)

            val headSize = dpToPx(32f).toFloat()
            val headLeft = (width - headSize) / 2f
            val headTop = dpToPx(4f).toFloat()
            val headRect = RectF(headLeft, headTop, headLeft + headSize, headTop + headSize)
            val headRadius = dpToPx(12f).toFloat()

            canvas.drawRoundRect(headRect, headRadius, headRadius, shadowPaint)
            canvas.drawRoundRect(headRect, headRadius, headRadius, fillPaint)

            val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.WHITE
                style = Paint.Style.STROKE
                strokeWidth = dpToPx(2.5f).toFloat()
            }
            canvas.drawRoundRect(headRect, headRadius, headRadius, borderPaint)

            val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.WHITE
                textAlign = Paint.Align.CENTER
                textSize = dpToPx(14f).toFloat()
                typeface = Typeface.DEFAULT_BOLD
            }

            val textY = headRect.centerY() - (textPaint.descent() + textPaint.ascent()) / 2
            canvas.drawText(routeText, headRect.centerX(), textY, textPaint)

            BitmapDescriptorFactory.fromBitmap(bitmap)
        }
    }

    fun clear() {
        busMarkerIconCache.clear()
        stopMarkerIcon = null
    }

    private fun createVectorDescriptor(id: Int, width: Int, height: Int): BitmapDescriptor? {
        val vectorDrawable = ContextCompat.getDrawable(context, id) ?: return null
        vectorDrawable.setBounds(0, 0, width, height)
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        vectorDrawable.draw(canvas)
        return BitmapDescriptorFactory.fromBitmap(bitmap)
    }

    private fun dpToPx(dp: Float): Int {
        return (dp * context.resources.displayMetrics.density).toInt()
    }
}
