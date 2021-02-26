package gd.not.i.nimgur.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import com.android.volley.Response.ErrorListener
import com.android.volley.toolbox.Volley
import gd.not.i.nimgur.R
import gd.not.i.nimgur.net.NimgurRequest
import org.json.JSONObject

class SendActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_send)
        when {
            intent?.action == Intent.ACTION_SEND -> {

                if (intent.type?.startsWith("image/") == true) {
                    handleSendImage(intent) // Handle single image being sent
                }
            }
            else -> {
                throw RuntimeException("rip lol")
            }
        }
    }


    private fun handleSendImage(intent: Intent) {
        val queue = Volley.newRequestQueue(this)

        Log.i("SendActivity", "Intent type: ${intent.type}")

        val thing = object :
            NimgurRequest(contentResolver, intent, "https://i.not.gd/up", ErrorListener {
                Log.e("SendActivity", "wow, error", it)
            }) {
            override fun deliverResponse(response: JSONObject?) {
                Log.i("SendActivity", "Response: ${response.toString()}");
            }
        }

        queue.add(thing)
    }
}