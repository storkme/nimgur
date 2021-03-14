package gd.not.nimgur.net

import com.android.volley.NetworkResponse
import com.android.volley.ParseError
import com.android.volley.Request
import com.android.volley.Response
import com.android.volley.toolbox.HttpHeaderParser
import org.json.JSONException
import org.json.JSONObject
import java.io.UnsupportedEncodingException
import java.nio.charset.Charset

abstract class NimgurRequest(
    url: String,
    private val body: ByteArray,
    private val bodyContentType: String,
    listener: Response.ErrorListener
) :
    Request<JSONObject>(
        Method.POST,
        url,
        listener
    ) {

    override fun getBody() = body

    override fun getBodyContentType() = bodyContentType

    override fun parseNetworkResponse(response: NetworkResponse): Response<JSONObject>? {
        return try {
            val jsonString = String(
                response.data,
                Charset.forName(HttpHeaderParser.parseCharset(response.headers, "utf-8"))
            )
            Response.success(
                JSONObject(jsonString), HttpHeaderParser.parseCacheHeaders(response)
            )
        } catch (e: UnsupportedEncodingException) {
            Response.error(ParseError(e))
        } catch (je: JSONException) {
            Response.error(ParseError(je))
        }
    }
}