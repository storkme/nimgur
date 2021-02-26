package gd.not.i.nimgur.net

import android.content.ContentResolver
import android.content.Intent
import android.net.Uri
import android.os.Parcelable
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
    private val contentResolver: ContentResolver,
    private val intent: Intent,
    url: String?,
    listener: Response.ErrorListener?
) :
    Request<JSONObject>(
        Method.POST,
        url,
        listener
    ) {

    override fun getBody(): ByteArray {
        val uri = intent.getParcelableExtra<Parcelable>(Intent.EXTRA_STREAM) as Uri
        val inputStream = contentResolver.openInputStream(uri)
        inputStream!!.buffered().use {
            return it.readBytes()
        }
    }

    override fun getBodyContentType() = intent.type!!

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