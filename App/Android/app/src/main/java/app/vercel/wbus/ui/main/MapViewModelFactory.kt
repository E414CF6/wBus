package app.vercel.wbus.ui.main

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import app.vercel.wbus.data.repository.BusRepository
import app.vercel.wbus.data.repository.StaticDataRepository

/**
 * Factory for creating MapViewModel with dependencies
 */
class MapViewModelFactory(
    private val busRepository: BusRepository, private val staticDataRepository: StaticDataRepository
) : ViewModelProvider.Factory {

    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(MapViewModel::class.java)) {
            return MapViewModel(busRepository, staticDataRepository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
