package app.vercel.wbus.data.api.adapter

import com.squareup.moshi.*

@Retention(AnnotationRetention.RUNTIME)
@JsonQualifier
annotation class RouteNo

class RouteNoJsonAdapter {
    @FromJson
    @RouteNo
    fun fromJson(reader: JsonReader): String {
        return when (reader.peek()) {
            JsonReader.Token.STRING, JsonReader.Token.NUMBER -> reader.nextString()
            else -> throw JsonDataException("Expected route number as string or number at ${reader.path}")
        }
    }

    @ToJson
    fun toJson(@RouteNo value: String?): String? = value
}
