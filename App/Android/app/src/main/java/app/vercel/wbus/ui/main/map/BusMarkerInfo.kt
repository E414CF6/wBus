package app.vercel.wbus.ui.main.map

data class BusMarkerInfo(
    val busId: String, val routeName: String, val plateNumber: String, val direction: Int?
)
