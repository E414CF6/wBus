package app.vercel.wbus.ui.main

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.view.updateLayoutParams
import app.vercel.wbus.data.api.ApiClient
import app.vercel.wbus.data.common.Result
import app.vercel.wbus.data.model.BusStopArrival
import app.vercel.wbus.data.repository.BusRepository
import app.vercel.wbus.ui.theme.WBusTheme
import app.vercel.wbus.ui.theme.getUrgencyColorFromMinutes
import app.vercel.wbus.ui.theme.getUrgencyText
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class StopArrivalDialog(
    private val stopId: String, private val stopName: String, private val onRouteSelected: (BusStopArrival) -> Unit = {}
) : BottomSheetDialogFragment() {

    override fun getTheme(): Int = app.vercel.wbus.R.style.TransparentBottomSheetDialog

    private val busRepository = BusRepository(ApiClient.wbusApiService)

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setBackgroundColor(ContextCompat.getColor(context, android.R.color.transparent))
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

    override fun onStart() {
        super.onStart()
        val bottomSheetDialog = dialog as? BottomSheetDialog ?: return
        bottomSheetDialog.window?.setBackgroundDrawableResource(android.R.color.transparent)
        val bottomSheet = bottomSheetDialog.findViewById<FrameLayout>(
            com.google.android.material.R.id.design_bottom_sheet
        ) ?: return

        (bottomSheet.parent as? View)?.setBackgroundColor(android.graphics.Color.TRANSPARENT)
        bottomSheet.setBackgroundColor(android.graphics.Color.TRANSPARENT)
        bottomSheet.updateLayoutParams<ViewGroup.MarginLayoutParams> {
            leftMargin = resources.getDimensionPixelSize(app.vercel.wbus.R.dimen.spacing_3)
            rightMargin = resources.getDimensionPixelSize(app.vercel.wbus.R.dimen.spacing_3)
            bottomMargin = resources.getDimensionPixelSize(app.vercel.wbus.R.dimen.spacing_3)
        }
        bottomSheet.layoutParams.height = ViewGroup.LayoutParams.WRAP_CONTENT

        BottomSheetBehavior.from(bottomSheet).apply {
            isFitToContents = true
            skipCollapsed = true
            state = BottomSheetBehavior.STATE_EXPANDED
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
    val sortedArrivals = remember(arrivals) {
        arrivals.sortedWith(compareBy<BusStopArrival> { if (it.arrtime < 0) Int.MAX_VALUE else it.arrtime }.thenBy { it.arrprevstationcnt }
            .thenBy { it.routeno })
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(0.dp), contentAlignment = Alignment.BottomCenter
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 600.dp)
                .heightIn(min = 200.dp),
            shape = RoundedCornerShape(32.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 8.dp,
            shadowElevation = 16.dp
        ) {
            Column(
                modifier = Modifier
                    .padding(horizontal = 20.dp, vertical = 14.dp)
                    .fillMaxWidth()
                    .heightIn(min = 220.dp)
            ) {
                Box(
                    modifier = Modifier
                        .width(52.dp)
                        .height(6.dp)
                        .background(
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.22f),
                            shape = RoundedCornerShape(999.dp)
                        )
                        .align(Alignment.CenterHorizontally)
                )

                Spacer(modifier = Modifier.height(14.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Top,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = stopName,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.weight(1f)
                    )
                    Surface(
                        shape = RoundedCornerShape(999.dp),
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                    ) {
                        Text(
                            text = "가장 빠른 순",
                            color = MaterialTheme.colorScheme.primary,
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "도착 정보 ${sortedArrivals.size}개",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
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
                            .heightIn(max = 440.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        contentPadding = PaddingValues(top = 2.dp, bottom = 12.dp)
                    ) {
                        items(sortedArrivals) { arrival ->
                            ArrivalListItem(arrival = arrival, onClick = { onArrivalClick(arrival) })
                        }
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
    val vehicleLabel = if (arrival.vehicletp.contains("저상")) "저상" else arrival.vehicletp

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        border = BorderStroke(1.dp, urgencyColor.copy(alpha = 0.45f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
        shape = RoundedCornerShape(22.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    brush = Brush.horizontalGradient(
                        listOf(
                            urgencyColor.copy(alpha = 0.14f), MaterialTheme.colorScheme.surface
                        )
                    )
                )
                .padding(16.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "${arrival.routeno}번",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Surface(color = urgencyColor, shape = RoundedCornerShape(999.dp)) {
                        Text(
                            text = getUrgencyText(minutes),
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(42.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(urgencyColor.copy(alpha = 0.2f)), contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.DirectionsBus,
                                contentDescription = null,
                                tint = urgencyColor,
                                modifier = Modifier.size(21.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = "${arrival.arrprevstationcnt}정거장 전",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    Surface(
                        shape = RoundedCornerShape(999.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.65f)
                    ) {
                        Text(
                            text = vehicleLabel,
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }
    }
}
