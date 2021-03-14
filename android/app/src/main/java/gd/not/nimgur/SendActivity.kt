package gd.not.nimgur

import android.annotation.SuppressLint
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Bundle
import android.os.Parcelable
import android.text.format.Formatter
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.preference.PreferenceManager
import com.android.volley.Response.ErrorListener
import com.android.volley.toolbox.Volley
import gd.not.nimgur.databinding.ActivitySendBinding
import gd.not.nimgur.net.NimgurRequest
import org.json.JSONObject

class SendActivity : ComponentActivity() {
    private lateinit var binding: ActivitySendBinding
    private lateinit var sharedPreferences: SharedPreferences


    @SuppressLint("ApplySharedPref")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySendBinding.inflate(layoutInflater)
        val view = binding.root
        setContentView(view)

        sharedPreferences = PreferenceManager.getDefaultSharedPreferences(this)

        binding.buttonRetry.setOnClickListener {
            sharedPreferences.edit().putString("upload_url", binding.editUrl.text.toString())
                .commit()
            handleSendImage(intent)
        }

        when (intent?.action) {
            Intent.ACTION_SEND -> {
                if (intent.type?.startsWith("image/") == true) {
                    handleSendImage(intent) // Handle single image being sent
                }
            }
            else -> {
                throw RuntimeException("rip")
            }
        }
    }

    private fun handleSendImage(intent: Intent) {
        val url = sharedPreferences.getString("upload_url", null)

        if (url == null) {
            binding.textSend.text = getString(R.string.edit_url_summary)
            binding.editUrl.visibility = View.VISIBLE
            binding.buttonRetry.visibility = View.VISIBLE
        } else {
            binding.editUrl.visibility = View.GONE
            binding.buttonRetry.visibility = View.GONE
            send(intent, url)
        }
    }

    private fun send(intent: Intent, uploadUrl: String) {
        val queue = Volley.newRequestQueue(this)
        val type = intent.type!!

        Log.i("SendActivity", "Sending to URL: $uploadUrl")

        try {
            val uri = intent.getParcelableExtra<Parcelable>(Intent.EXTRA_STREAM) as Uri
            val body = contentResolver.openInputStream(uri)!!.buffered().use { it.readBytes() }
            val request = object :
                NimgurRequest(uploadUrl, body, type, ErrorListener {
                    handleError(it, type)
                }) {
                override fun deliverResponse(response: JSONObject?) {
                    Log.i("SendActivity", "Response: ${response.toString()}");
                    val toast = Toast.makeText(
                        applicationContext,
                        "URL copied to clipboard",
                        Toast.LENGTH_SHORT
                    )
                    toast.show()

                    val clipboard = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
                    val clip: ClipData =
                        ClipData.newPlainText("simple text", response?.getString("href"))
                    clipboard.setPrimaryClip(clip)

                    finish()
                }
            }

            binding.textSend.text = getString(
                R.string.send_text,
                Formatter.formatFileSize(this, request.body.size.toLong()),
                uploadUrl
            )

            queue.add(request)

        } catch (e: Exception) {
            Log.e("SendActivity", "what is this stuff", e)
            handleError(e, type)
        }
    }

    private fun handleError(it: Exception, type: String) {
        Log.e("help", "handle the error...")
        binding.textSend.text = getString(R.string.upload_err, it)
        binding.editUrl.visibility = View.VISIBLE
        binding.buttonRetry.visibility = View.VISIBLE
    }
}