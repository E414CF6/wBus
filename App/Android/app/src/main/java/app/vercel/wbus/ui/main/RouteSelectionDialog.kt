package app.vercel.wbus.ui.main

import android.app.Dialog
import android.os.Bundle
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.fragment.app.DialogFragment
import app.vercel.wbus.ui.theme.WBusTheme

class RouteSelectionDialog(
    private val routes: List<RouteItem>,
    private val currentRoute: String,
    private val onRouteSelected: (RouteItem) -> Unit
) : DialogFragment() {

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val dialog = Dialog(requireContext())
        val composeView = ComposeView(requireContext()).apply {
            setContent {
                WBusTheme {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp)
                            .clip(RoundedCornerShape(28.dp)),
                        color = MaterialTheme.colorScheme.surface,
                        tonalElevation = 6.dp
                    ) {
                        Column(
                            modifier = Modifier
                                .padding(24.dp)
                                .fillMaxWidth()
                        ) {
                            Text(
                                text = "노선 선택",
                                style = MaterialTheme.typography.headlineSmall,
                                fontWeight = FontWeight.ExtraBold,
                                color = MaterialTheme.colorScheme.onSurface
                            )

                            Spacer(modifier = Modifier.height(16.dp))

                            LazyColumn(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(max = 400.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                items(routes) { route ->
                                    RouteSelectionItem(
                                        route = route, isSelected = route.routeNumber == currentRoute, onClick = {
                                            onRouteSelected(route)
                                            dismiss()
                                        })
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            TextButton(
                                onClick = { dismiss() }, modifier = Modifier.align(Alignment.End)
                            ) {
                                Text("취소")
                            }
                        }
                    }
                }
            }
        }
        dialog.setContentView(composeView)
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        // Make the dialog width match parent with padding
        dialog.window?.setLayout(
            android.view.ViewGroup.LayoutParams.MATCH_PARENT, android.view.ViewGroup.LayoutParams.WRAP_CONTENT
        )

        return dialog
    }
}

@Composable
fun RouteSelectionItem(
    route: RouteItem, isSelected: Boolean, onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
        color = if (isSelected) {
            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.7f)
        } else {
            Color.Transparent
        }
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = route.displayName,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                color = if (isSelected) {
                    MaterialTheme.colorScheme.onPrimaryContainer
                } else {
                    MaterialTheme.colorScheme.onSurface
                }
            )

            if (route.routeIds.size > 1) {
                Surface(
                    color = MaterialTheme.colorScheme.secondaryContainer, shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "${route.routeIds.size}",
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
            }
        }
    }
}
