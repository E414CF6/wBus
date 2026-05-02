package app.vercel.wbus.ui.main

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.DirectionsBus
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.vercel.wbus.data.api.ApiClient
import app.vercel.wbus.data.common.Result
import app.vercel.wbus.data.model.BusStopArrival
import app.vercel.wbus.data.repository.BusRepository
import app.vercel.wbus.ui.theme.WBusTheme
import app.vercel.wbus.ui.theme.getUrgencyColorFromMinutes
import app.vercel.wbus.ui.theme.getUrgencyText
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class StopArrivalDialog(
    private val stopId: String, private val stopName: String, private val onRouteSelected: (BusStopArrival) -> Unit = {}
) : BottomSheetDialogFragment() {

    private val busRepository = BusRepository(ApiClient.wbusApiService)

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setContent {
                WBusTheme {
                    StopArrivalContent(
                        stopName = stopName, stopId = stopId, repository = busRepository, onArrivalClick = { arrival ->
                            onRouteSelected(arrival)
                            dismissAllowingStateLoss()
                        })
                }
            }
        }
    }
}

@Composable
fun StopArrivalContent(
    stopName: String, stopId: String, repository: BusRepository, onArrivalClick: (BusStopArrival) -> Unit
) {
    var arrivals by remember { mutableStateOf<List<BusStopArrival>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var isError by remember { mutableStateOf(false) }

    LaunchedEffect(stopId) {
        isLoading = true
        val result = withContext(Dispatchers.IO) {
            repository.getBusArrivals(stopId)
        }
        isLoading = false
        if (result is Result.Success) {
            arrivals = result.data
            isError = false
        } else {
            isError = true
        }
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 200.dp),
        shape = RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp),
        color = MaterialTheme.colorScheme.surface
    ) {
        Column(
            modifier = Modifier
                .padding(24.dp)
                .fillMaxWidth()
        ) {
            // Drag handle
            Box(
                modifier = Modifier
                    .width(40.dp)
                    .height(4.dp)
                    .background(
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.2f),
                        shape = RoundedCornerShape(2.dp)
                    )
                    .align(Alignment.CenterHorizontally)
            )

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = stopName,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.ExtraBold,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(16.dp))

            if (isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp), contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            } else if (isError) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp), contentAlignment = Alignment.Center
                ) {
                    Text("도착 정보를 불러올 수 없습니다", color = MaterialTheme.colorScheme.error)
                }
            } else if (arrivals.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp), contentAlignment = Alignment.Center
                ) {
                    Text("도착 정보가 없습니다", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 400.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = PaddingValues(bottom = 16.dp)
                ) {
                    items(arrivals) { arrival ->
                        ArrivalListItem(arrival = arrival, onClick = { onArrivalClick(arrival) })
                    }
                }
            }
        }
    }
}

@Composable
fun ArrivalListItem(arrival: BusStopArrival, onClick: () -> Unit) {
    val minutes = arrival.arrtime / 60
    val urgencyColor = getUrgencyColorFromMinutes(minutes)

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick), colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
        ), shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(urgencyColor.copy(alpha = 0.15f)), contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Rounded.DirectionsBus,
                        contentDescription = null,
                        tint = urgencyColor,
                        modifier = Modifier.size(22.dp)
                    )
                }

                Spacer(modifier = Modifier.width(16.dp))

                Column {
                    Text(
                        text = "${arrival.routeno}번",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "${arrival.arrprevstationcnt}정거장 전",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Surface(
                color = urgencyColor, shape = RoundedCornerShape(10.dp)
            ) {
                Text(
                    text = getUrgencyText(minutes),
                    color = Color.White,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.ExtraBold
                )
            }
        }
    }
}
